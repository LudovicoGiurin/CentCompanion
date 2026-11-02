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
      message: "Invalid score. Each player can have 0, 1, or 2 games won.",
    };
  }
  if (p1Games === MAX_GAMES && p2Games === MAX_GAMES) {
    return {
      ok: false,
      message: "Invalid score. Both players cannot have 2 games won.",
    };
  }

  let result: MatchOutcome;
  if (p1Games === p2Games) result = "draw";
  else if (p1Games > p2Games) result = "p1_win";
  else result = "p2_win";

  return { ok: true, p1Games, p2Games, result };
}

export function gamesFromResult(result: MatchOutcome): { p1Games: number; p2Games: number } {
  switch (result) {
    case "p1_win":
      return { p1Games: 2, p2Games: 0 };
    case "p2_win":
      return { p1Games: 0, p2Games: 2 };
    case "draw":
      return { p1Games: 1, p2Games: 1 };
  }
}

export function formatMatchScore(p1Games: number | null | undefined, p2Games: number | null | undefined): string | null {
  if (p1Games == null || p2Games == null) return null;
  return `${p1Games}–${p2Games}`;
}
