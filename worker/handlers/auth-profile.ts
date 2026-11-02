import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { error, getAuthUser, json } from "../_shared/auth";
import { earnedFrames, syncAchievements } from "../_shared/achievements";
import { ensureDefaultAvatarUrl } from "../_shared/default-avatar";
import { publicUser } from "../_shared/users";

/** ~800KB of base64 ≈ 600KB image — client resizes before upload. */
const MAX_AVATAR_LENGTH = 800_000;
/** Cover banners are wider; allow a bit more room. */
const MAX_COVER_LENGTH = 1_200_000;
const DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const patchSchema = z.object({
  avatar: z.string().nullable().optional(),
  cover: z.string().nullable().optional(),
  equippedFrame: z.string().max(32).nullable().optional(),
});

function profilePayload(user: typeof users.$inferSelect, achievements: Awaited<ReturnType<typeof syncAchievements>>) {
  return {
    user: publicUser(user),
    profile: {
      avatar: user.avatarCustom ?? user.avatarUrl,
      defaultAvatarUrl: user.avatarUrl,
      hasCustomAvatar: Boolean(user.avatarCustom),
      cover: user.coverCustom ?? user.avatarUrl,
      defaultCoverUrl: user.avatarUrl,
      hasCustomCover: Boolean(user.coverCustom),
      equippedFrame: user.equippedFrame,
      achievements,
    },
  };
}

export async function handleAuthProfile(req: Request): Promise<Response> {
  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);

  const db = getDb();

  if (req.method === "GET") {
    let user = authUser;

    // Accounts created before the profile feature (or when Scryfall was
    // unreachable at signup) get their default artwork lazily.
    if (!user.avatarUrl) {
      const url = await ensureDefaultAvatarUrl(db, user);
      if (url) {
        const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
        if (updated) user = updated;
      }
    }

    const achievements = await syncAchievements(db, user.id);
    return json(profilePayload(user, achievements));
  }

  if (req.method !== "PATCH") return error("Method not allowed", 405);

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) return error("Invalid input");

  const set: Partial<typeof users.$inferInsert> = {};

  if (body.data.avatar !== undefined) {
    if (body.data.avatar === null) {
      return error("Cannot clear custom avatar");
    }
    if (body.data.avatar.length > MAX_AVATAR_LENGTH) return error("Image too large (max ~600KB)", 413);
    if (!DATA_URL_RE.test(body.data.avatar)) return error("Invalid image format");
    set.avatarCustom = body.data.avatar;
  }

  if (body.data.cover !== undefined) {
    if (body.data.cover === null) {
      return error("Cannot clear custom cover");
    }
    if (body.data.cover.length > MAX_COVER_LENGTH) return error("Cover image too large", 413);
    if (!DATA_URL_RE.test(body.data.cover)) return error("Invalid image format");
    set.coverCustom = body.data.cover;
  }

  if (body.data.equippedFrame !== undefined) {
    if (body.data.equippedFrame === null) {
      set.equippedFrame = null;
    } else {
      const achievements = await syncAchievements(db, authUser.id);
      const frames = earnedFrames(achievements);
      if (!frames.has(body.data.equippedFrame as never)) {
        return error("Frame not unlocked", 403);
      }
      set.equippedFrame = body.data.equippedFrame;
    }
  }

  if (!Object.keys(set).length) return error("Nothing to update");

  const [user] = await db
    .update(users)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(users.id, authUser.id))
    .returning();

  const achievements = await syncAchievements(db, user.id);
  return json(profilePayload(user, achievements));
}
