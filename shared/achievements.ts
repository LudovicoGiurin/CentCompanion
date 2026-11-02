/**
 * Achievement + medal frame definitions shared by worker and frontend.
 * Each achievement awards a medal; the medal unlocks a frame artwork
 * for the (square) profile picture.
 */

export type AchievementCode =
  | "welcome"
  | "contender"
  | "first_blood"
  | "veteran"
  | "slayer";

export type FrameId = "bronze" | "jade" | "steel" | "gold" | "crimson";

export type AchievementDef = {
  code: AchievementCode;
  /** Frame artwork unlocked by this medal */
  frame: FrameId;
  /** Phosphor icon name (without the leading "ph ph-") */
  icon: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "welcome", frame: "bronze", icon: "hand-waving" },
  { code: "contender", frame: "jade", icon: "flag-banner" },
  { code: "first_blood", frame: "steel", icon: "sword" },
  { code: "veteran", frame: "gold", icon: "shield-star" },
  { code: "slayer", frame: "crimson", icon: "crown-simple" },
];

export const FRAME_BY_ACHIEVEMENT: Record<AchievementCode, FrameId> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.code, a.frame]),
) as Record<AchievementCode, FrameId>;

export function isAchievementCode(value: string): value is AchievementCode {
  return ACHIEVEMENTS.some((a) => a.code === value);
}
