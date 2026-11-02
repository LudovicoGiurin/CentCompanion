import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../../db/index";
import { eventRegistrations, matches, userAchievements } from "../../db/schema";
import { ACHIEVEMENTS, type AchievementCode, type FrameId, FRAME_BY_ACHIEVEMENT } from "../../shared/achievements";

type Db = ReturnType<typeof getDb>;

export type EarnedAchievement = {
  code: AchievementCode;
  frame: FrameId;
  earnedAt: string;
};

/**
 * Recomputes which achievements the user qualifies for, persists any newly
 * earned ones, and returns the full earned list (in definition order).
 */
export async function syncAchievements(db: Db, userId: number): Promise<EarnedAchievement[]> {
  const existing = await db
    .select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const have = new Set(existing.map((r) => r.code));
  const missing = ACHIEVEMENTS.filter((a) => !have.has(a.code));

  if (missing.length) {
    const [regRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.userId, userId));
    const [winRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(matches)
      .where(
        or(
          and(eq(matches.player1Id, userId), eq(matches.result, "p1_win")),
          and(eq(matches.player2Id, userId), eq(matches.result, "p2_win")),
        ),
      );
    const regs = regRow?.n ?? 0;
    const wins = winRow?.n ?? 0;

    const qualified = new Set<AchievementCode>(["welcome"]);
    if (regs >= 1) qualified.add("contender");
    if (regs >= 5) qualified.add("veteran");
    if (wins >= 1) qualified.add("first_blood");
    if (wins >= 10) qualified.add("slayer");

    const toInsert = missing.filter((a) => qualified.has(a.code));
    if (toInsert.length) {
      await db
        .insert(userAchievements)
        .values(toInsert.map((a) => ({ userId, code: a.code })))
        .onConflictDoNothing();
    }
  }

  const rows = await db
    .select()
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const byCode = new Map(rows.map((r) => [r.code, r]));

  return ACHIEVEMENTS.filter((a) => byCode.has(a.code)).map((a) => ({
    code: a.code,
    frame: a.frame,
    earnedAt: byCode.get(a.code)!.earnedAt.toISOString(),
  }));
}

export function earnedFrames(achievements: EarnedAchievement[]): Set<FrameId> {
  return new Set(achievements.map((a) => FRAME_BY_ACHIEVEMENT[a.code]));
}
