import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { syncAchievements } from "../_shared/achievements";
import { error, json } from "../_shared/auth";
import { ensureDefaultAvatarUrl } from "../_shared/default-avatar";
import { fetchItalianLeaderboard, findPlayerByName } from "../_shared/google-leaderboard";
import { formatPlayerName, isSyntheticUser } from "../_shared/registrations";
import { socialUser } from "../_shared/users";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Public social profile (no email / private settings). */
export async function handlePublicUser(req: Request, params: { id: string }): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);

  const id = parseId(params.id);
  if (id == null) return error("Not found", 404);

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user || isSyntheticUser(user) || user.displayName === "Deleted User") {
    return error("Not found", 404);
  }

  // Lazy Scryfall art for older accounts (same as own profile GET).
  let row = user;
  if (!row.avatarUrl) {
    const url = await ensureDefaultAvatarUrl(db, row);
    if (url) {
      const [updated] = await db.select().from(users).where(eq(users.id, row.id)).limit(1);
      if (updated) row = updated;
    }
  }

  const achievements = await syncAchievements(db, row.id);

  let standing: {
    points: number;
    rank: number | null;
    playerName: string | null;
    wins: number;
    losses: number;
    draws: number;
    eventsPlayed: number;
  } | null = null;

  try {
    const sheet = await fetchItalianLeaderboard();
    const match = findPlayerByName(sheet.players, [
      formatPlayerName(row.firstName, row.lastName),
      row.username,
      row.displayName,
    ]);
    if (match) {
      standing = {
        points: match.total,
        rank: match.rank,
        playerName: match.playerName,
        wins: 0,
        losses: 0,
        draws: 0,
        eventsPlayed: match.events.filter((e) => e.value !== null).length,
      };
    }
  } catch {
    /* sheet unavailable */
  }

  return json({
    user: socialUser(row),
    standing,
    profile: {
      avatar: row.avatarCustom ?? row.avatarUrl,
      defaultAvatarUrl: row.avatarUrl,
      hasCustomAvatar: Boolean(row.avatarCustom),
      cover: row.coverCustom ?? row.avatarUrl,
      defaultCoverUrl: row.avatarUrl,
      hasCustomCover: Boolean(row.coverCustom),
      equippedFrame: row.equippedFrame,
      achievements,
    },
  });
}

/** Lightweight avatar for lists — never embeds base64 in JSON. */
export async function handlePublicUserAvatar(req: Request, params: { id: string }): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);

  const id = parseId(params.id);
  if (id == null) return error("Not found", 404);

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      avatarCustom: users.avatarCustom,
      avatarUrl: users.avatarUrl,
      passwordHash: users.passwordHash,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user || isSyntheticUser(user) || user.displayName === "Deleted User") {
    return error("Not found", 404);
  }

  if (user.avatarCustom?.startsWith("data:image/")) {
    const comma = user.avatarCustom.indexOf(",");
    if (comma < 0) return error("Not found", 404);
    const header = user.avatarCustom.slice(0, comma);
    const mime = header.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/)?.[1] ?? "image/png";
    const bytes = Uint8Array.from(atob(user.avatarCustom.slice(comma + 1)), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (user.avatarUrl) {
    return Response.redirect(user.avatarUrl, 302);
  }

  return error("Not found", 404);
}
