import i18n from "../i18n";

export type MatchOutcome = "p1_win" | "p2_win" | "draw";

const MIN_GAMES = 0;
const MAX_GAMES = 2;

function inRange(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_GAMES && n <= MAX_GAMES;
}

export function parseBo3Score(
  p1Games: number,
  p2Games: number,
):
  | { ok: true; p1Games: number; p2Games: number; result: MatchOutcome }
  | { ok: false; message: string } {
  if (!inRange(p1Games) || !inRange(p2Games)) {
    return {
      ok: false,
      message: i18n.t("tournament:score.invalid"),
    };
  }
  if (p1Games === MAX_GAMES && p2Games === MAX_GAMES) {
    return {
      ok: false,
      message: i18n.t("tournament:score.invalid"),
    };
  }

  let result: MatchOutcome;
  if (p1Games === p2Games) result = "draw";
  else if (p1Games > p2Games) result = "p1_win";
  else result = "p2_win";

  return { ok: true, p1Games, p2Games, result };
}

export function formatMatchScore(p1Games: number | null | undefined, p2Games: number | null | undefined): string | null {
  if (p1Games == null || p2Games == null) return null;
  return `${p1Games}–${p2Games}`;
}

export function myMatchScore(
  p1Games: number | null | undefined,
  p2Games: number | null | undefined,
  userId: number,
  player1Id: number,
): string | null {
  if (p1Games == null || p2Games == null) return null;
  return player1Id === userId ? `${p1Games}–${p2Games}` : `${p2Games}–${p1Games}`;
}

export function bo3ScoreHint(): string {
  return i18n.t("tournament:score.hint");
}
