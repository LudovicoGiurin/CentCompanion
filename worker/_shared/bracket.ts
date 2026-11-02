import type { PairingInsert } from "./swiss";

/** Seed single-elim bracket from ranked player ids (best seed = index 0). */
export function seedSingleElimBracket(seededPlayerIds: number[]): PairingInsert[] {
  if (seededPlayerIds.length === 0) return [];

  const bracketSize = Math.max(2, 2 ** Math.ceil(Math.log2(seededPlayerIds.length)));
  const slots: (number | null)[] = Array.from({ length: bracketSize }, () => null);

  // Standard bracket seeding: 1 vs N, 2 vs N-1, ...
  for (let i = 0; i < seededPlayerIds.length; i++) {
    slots[i] = seededPlayerIds[i];
  }

  const ordered = orderBracketSlots(slots);
  const pairings: PairingInsert[] = [];
  let table = 1;
  for (let i = 0; i < ordered.length; i += 2) {
    const a = ordered[i];
    const b = ordered[i + 1] ?? null;
    if (a == null && b == null) continue;
    if (a != null && b == null) {
      pairings.push({ player1Id: a, player2Id: null, tableNumber: table++ });
    } else if (a == null && b != null) {
      pairings.push({ player1Id: b, player2Id: null, tableNumber: table++ });
    } else {
      pairings.push({ player1Id: a!, player2Id: b, tableNumber: table++ });
    }
  }
  return pairings;
}

function orderBracketSlots(seeds: (number | null)[]): (number | null)[] {
  const n = seeds.length;
  if (n <= 2) return seeds;
  const bracketOrder = buildBracketOrder(n);
  return bracketOrder.map((seedIndex) => seeds[seedIndex] ?? null);
}

function buildBracketOrder(size: number): number[] {
  if (size === 1) return [0];
  if (size === 2) return [0, 1];
  const half = size / 2;
  const prev = buildBracketOrder(half);
  const result: number[] = [];
  for (const p of prev) {
    result.push(p);
    result.push(size - 1 - p);
  }
  return result;
}

export function singleElimRoundsForCut(cutSize: number): number {
  if (cutSize < 2) return 0;
  return Math.ceil(Math.log2(cutSize));
}

export function advanceWinners(
  roundMatches: {
    player1Id: number;
    player2Id: number | null;
    result: "pending" | "p1_win" | "p2_win" | "draw";
  }[],
): number[] {
  const winners: number[] = [];
  for (const m of roundMatches) {
    if (!m.player2Id) {
      winners.push(m.player1Id);
      continue;
    }
    if (m.result === "p1_win") winners.push(m.player1Id);
    else if (m.result === "p2_win") winners.push(m.player2Id);
    else if (m.result === "draw") {
      // Draws should not happen in elim; treat as unresolved
      continue;
    }
  }
  return winners;
}

export function pairWinnersForNextRound(winners: number[]): PairingInsert[] {
  const pairings: PairingInsert[] = [];
  let table = 1;
  for (let i = 0; i < winners.length; i += 2) {
    pairings.push({
      player1Id: winners[i],
      player2Id: winners[i + 1] ?? null,
      tableNumber: table++,
    });
  }
  return pairings;
}
