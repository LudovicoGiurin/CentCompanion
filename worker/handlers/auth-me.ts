import { fetchItalianLeaderboard, findPlayerByName } from "../_shared/google-leaderboard";
import { error, getAuthUser, json } from "../_shared/auth";
import { ensureDefaultAvatarUrl } from "../_shared/default-avatar";
import { formatPlayerName } from "../_shared/registrations";
import { publicUser } from "../_shared/users";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

export async function handleAuthMe(req: Request): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);

  let user = await getAuthUser(req);
  if (!user) return error("Unauthorized", 401);

  if (!user.avatarUrl) {
    const db = getDb();
    const url = await ensureDefaultAvatarUrl(db, user);
    if (url) {
      const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      if (updated) user = updated;
    }
  }

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
      formatPlayerName(user.firstName, user.lastName),
      user.username,
    ]);
    if (match) {
      const eventsPlayed = match.events.filter((e) => e.value !== null).length;
      standing = {
        points: match.total,
        rank: match.rank,
        playerName: match.playerName,
        wins: 0,
        losses: 0,
        draws: 0,
        eventsPlayed,
      };
    }
  } catch {
    /* sheet unavailable */
  }

  return json({
    user: publicUser(user),
    standing,
  });
}
