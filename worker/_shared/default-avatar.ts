import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { fetchRandomLegendaryArt } from "./scryfall";

type Db = ReturnType<typeof getDb>;

/**
 * Ensures a real account has a default Scryfall art URL persisted.
 * Safe to call from list endpoints (leaderboard) so avatars appear
 * without requiring a profile visit first.
 */
export async function ensureDefaultAvatarUrl(
  db: Db,
  user: { id: number; avatarUrl: string | null; avatarCustom?: string | null },
): Promise<string | null> {
  if (user.avatarCustom) {
    // Custom upload — default art not needed for display, but keep avatarUrl as-is.
    return user.avatarUrl;
  }
  if (user.avatarUrl) return user.avatarUrl;

  const art = await fetchRandomLegendaryArt();
  if (!art) return null;

  await db
    .update(users)
    .set({ avatarUrl: art.url, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return art.url;
}

/** Backfill missing defaults for many users (e.g. claimed leaderboard rows). */
export async function ensureDefaultAvatarUrls(
  db: Db,
  rows: { id: number; avatarUrl: string | null; avatarCustom?: string | null }[],
): Promise<Map<number, string>> {
  const assigned = new Map<number, string>();
  const missing = rows.filter((u) => !u.avatarUrl && !u.avatarCustom);
  if (!missing.length) return assigned;

  // Scryfall allows modest parallelism; cap to avoid bursts on cold leaderboards.
  const CONCURRENCY = 4;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const chunk = missing.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (u) => {
        const url = await ensureDefaultAvatarUrl(db, u);
        if (url) assigned.set(u.id, url);
      }),
    );
  }
  return assigned;
}
