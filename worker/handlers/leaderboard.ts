import { inArray } from "drizzle-orm";
import { getDb } from "../../db/index";
import { userAchievements, users } from "../../db/schema";
import {
  ACHIEVEMENTS,
  FRAME_BY_ACHIEVEMENT,
  isAchievementCode,
  type AchievementCode,
  type FrameId,
} from "../../shared/achievements";
import { error, getAuthUser, json } from "../_shared/auth";
import {
  fetchItalianLeaderboard,
  findPlayerByName,
  type LeaderboardPlayer,
} from "../_shared/google-leaderboard";
import { formatPlayerName, isSyntheticUser } from "../_shared/registrations";
import { listAvatarSrc } from "../_shared/users";
import { ensureDefaultAvatarUrls } from "../_shared/default-avatar";

export type LeaderboardAchievement = {
  code: AchievementCode;
  frame: FrameId;
};

export type LeaderboardPlayerWithClaims = LeaderboardPlayer & {
  /** True when a Cent Companion account matches this sheet name */
  claimed: boolean;
  userId: number | null;
  username: string | null;
  avatarUrl: string | null;
  equippedFrame: string | null;
  achievements: LeaderboardAchievement[];
};

function normalizeKey(name: string | null | undefined): string {
  return name?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function pushAlias(map: Map<string, number[]>, name: string | null | undefined, userId: number) {
  const key = normalizeKey(name);
  if (!key) return;
  const list = map.get(key);
  if (list) {
    if (!list.includes(userId)) list.push(userId);
  } else {
    map.set(key, [userId]);
  }
}

/** Prefer the account with the most medals; tie-break on lowest id (oldest). */
function pickBestUserId(
  candidates: number[],
  achievementCount: Map<number, number>,
  preferredUserId: number | null,
): number {
  if (preferredUserId != null && candidates.includes(preferredUserId)) {
    return preferredUserId;
  }
  return [...candidates].sort((a, b) => {
    const diff = (achievementCount.get(b) ?? 0) - (achievementCount.get(a) ?? 0);
    return diff !== 0 ? diff : a - b;
  })[0]!;
}

/** Match sheet rows to real accounts and attach earned achievements + social face. */
async function attachClaimedAchievements(
  players: LeaderboardPlayer[],
  preferredUserId: number | null = null,
): Promise<LeaderboardPlayerWithClaims[]> {
  const db = getDb();
  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: users.displayName,
      passwordHash: users.passwordHash,
      email: users.email,
      avatarCustom: users.avatarCustom,
      avatarUrl: users.avatarUrl,
      equippedFrame: users.equippedFrame,
    })
    .from(users);

  const byId = new Map(allUsers.map((u) => [u.id, u]));
  const nameToUserIds = new Map<string, number[]>();
  const realUserIds: number[] = [];

  for (const u of allUsers) {
    if (isSyntheticUser(u)) continue;
    if (u.displayName === "Deleted User") continue;
    realUserIds.push(u.id);
    pushAlias(nameToUserIds, formatPlayerName(u.firstName, u.lastName, ""), u.id);
    pushAlias(nameToUserIds, u.username, u.id);
    pushAlias(nameToUserIds, u.displayName, u.id);
  }

  const achievementCount = new Map<number, number>();
  const achievementsByUser = new Map<number, LeaderboardAchievement[]>();

  if (realUserIds.length) {
    const rows = await db
      .select({ userId: userAchievements.userId, code: userAchievements.code })
      .from(userAchievements)
      .where(inArray(userAchievements.userId, realUserIds));

    const codesByUser = new Map<number, Set<string>>();
    for (const row of rows) {
      if (!isAchievementCode(row.code)) continue;
      const set = codesByUser.get(row.userId) ?? new Set();
      set.add(row.code);
      codesByUser.set(row.userId, set);
    }

    for (const [uid, codes] of codesByUser) {
      achievementCount.set(uid, codes.size);
      achievementsByUser.set(
        uid,
        ACHIEVEMENTS.filter((a) => codes.has(a.code)).map((a) => ({
          code: a.code,
          frame: FRAME_BY_ACHIEVEMENT[a.code],
        })),
      );
    }
  }

  const playerUserId = new Map<string, number>();
  for (const p of players) {
    const candidates = nameToUserIds.get(normalizeKey(p.playerName));
    if (!candidates?.length) continue;
    playerUserId.set(p.playerName, pickBestUserId(candidates, achievementCount, preferredUserId));
  }

  // Persist Scryfall defaults for claimed rows that never opened their profile.
  const matchedUsers = [...new Set(playerUserId.values())]
    .map((id) => byId.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const filled = await ensureDefaultAvatarUrls(db, matchedUsers);
  for (const [id, url] of filled) {
    const prev = byId.get(id);
    if (prev) byId.set(id, { ...prev, avatarUrl: url });
  }

  return players.map((p) => {
    const userId = playerUserId.get(p.playerName) ?? null;
    const u = userId != null ? byId.get(userId) : null;
    return {
      ...p,
      claimed: userId != null,
      userId,
      username: u?.username ?? null,
      avatarUrl: u ? listAvatarSrc(u) : null,
      equippedFrame: u?.equippedFrame ?? null,
      achievements: userId != null ? (achievementsByUser.get(userId) ?? []) : [],
    };
  });
}

export async function handleLeaderboard(req: Request): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);

  try {
    const data = await fetchItalianLeaderboard();
    const authUser = await getAuthUser(req);
    const leaderboard = await attachClaimedAchievements(data.players, authUser?.id ?? null);

    const myStanding = authUser
      ? findPlayerByName(data.players, [
          formatPlayerName(authUser.firstName, authUser.lastName),
          authUser.username,
        ])
      : null;

    return json({
      season: "2026",
      title: data.title,
      sourceUrl: data.sourceUrl,
      syncedAt: data.syncedAt,
      eventColumns: data.eventColumns,
      leaderboard,
      myStanding: myStanding
        ? { rank: myStanding.rank, points: myStanding.total, playerName: myStanding.playerName }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load leaderboard";
    return error(message, 502);
  }
}
