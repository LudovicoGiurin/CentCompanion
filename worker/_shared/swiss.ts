export type MatchRecord = {
  round: number;
  player1Id: number;
  player2Id: number | null;
  result: "pending" | "p1_win" | "p2_win" | "draw";
};

export type StandingRow = {
  userId: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  opponentMatchWinPct: number;
  previousOpponents: number[];
};

export type PairingInsert = {
  player1Id: number;
  player2Id: number | null;
  tableNumber: number;
};

const WIN = 3;
const DRAW = 1;
const LOSS = 0;
const BYE = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function maxSwissRounds(playerCount: number): number {
  if (playerCount < 2) return 0;
  return Math.ceil(Math.log2(playerCount));
}

function matchPointsFor(playerId: number, m: MatchRecord): number {
  if (m.result === "pending") return 0;
  if (!m.player2Id) {
    return m.player1Id === playerId ? BYE : 0;
  }
  if (m.result === "draw") return DRAW;
  if (m.result === "p1_win") return m.player1Id === playerId ? WIN : LOSS;
  if (m.result === "p2_win") return m.player2Id === playerId ? WIN : LOSS;
  return 0;
}

function matchOutcomeFor(playerId: number, m: MatchRecord): "win" | "loss" | "draw" | "bye" | null {
  if (m.result === "pending") return null;
  if (!m.player2Id) return m.player1Id === playerId ? "bye" : null;
  if (m.result === "draw") return "draw";
  if (m.result === "p1_win") return m.player1Id === playerId ? "win" : "loss";
  if (m.result === "p2_win") return m.player2Id === playerId ? "win" : "loss";
  return null;
}

export function computeStandings(playerIds: number[], allMatches: MatchRecord[]): StandingRow[] {
  const resolved = allMatches.filter((m) => m.result !== "pending");

  const rows: StandingRow[] = playerIds.map((userId) => {
    const playerMatches = resolved.filter(
      (m) => m.player1Id === userId || m.player2Id === userId,
    );
    let points = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let byes = 0;
    const previousOpponents: number[] = [];

    for (const m of playerMatches) {
      points += matchPointsFor(userId, m);
      const outcome = matchOutcomeFor(userId, m);
      if (outcome === "win") wins++;
      else if (outcome === "loss") losses++;
      else if (outcome === "draw") draws++;
      else if (outcome === "bye") byes++;

      if (m.player2Id) {
        const opp = m.player1Id === userId ? m.player2Id : m.player1Id;
        previousOpponents.push(opp);
      }
    }

    return { userId, points, wins, losses, draws, byes, opponentMatchWinPct: 0, previousOpponents };
  });

  const pointsMap = new Map(rows.map((r) => [r.userId, r.points]));

  for (const row of rows) {
    const oppIds = row.previousOpponents;
    if (!oppIds.length) continue;
    const oppPoints = oppIds.map((id) => pointsMap.get(id) ?? 0);
    row.opponentMatchWinPct = oppPoints.reduce((a, b) => a + b, 0) / oppIds.length;
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.opponentMatchWinPct - a.opponentMatchWinPct;
  });

  return rows;
}

function pairRoundOne(playerIds: number[]): PairingInsert[] {
  const shuffled = shuffle(playerIds);
  const pairings: PairingInsert[] = [];
  let table = 1;
  for (let i = 0; i < shuffled.length; i += 2) {
    pairings.push({
      player1Id: shuffled[i],
      player2Id: shuffled[i + 1] ?? null,
      tableNumber: table++,
    });
  }
  return pairings;
}

function hasPlayed(a: number, b: number, previous: Map<number, Set<number>>): boolean {
  return previous.get(a)?.has(b) ?? false;
}

function pairSwissRound(standings: StandingRow[]): PairingInsert[] {
  const available = [...standings];
  const paired = new Set<number>();
  const pairings: PairingInsert[] = [];
  let table = 1;

  const previous = new Map<number, Set<number>>();
  for (const s of standings) {
    previous.set(s.userId, new Set(s.previousOpponents));
  }

  if (available.length % 2 === 1) {
    const byeCandidate = [...available]
      .sort((a, b) => {
        if (a.byes !== b.byes) return a.byes - b.byes;
        if (a.points !== b.points) return a.points - b.points;
        return a.opponentMatchWinPct - b.opponentMatchWinPct;
      })[0];
    pairings.push({
      player1Id: byeCandidate.userId,
      player2Id: null,
      tableNumber: table++,
    });
    paired.add(byeCandidate.userId);
    const idx = available.findIndex((s) => s.userId === byeCandidate.userId);
    if (idx >= 0) available.splice(idx, 1);
  }

  const buckets = new Map<number, StandingRow[]>();
  for (const s of available) {
    const list = buckets.get(s.points) ?? [];
    list.push(s);
    buckets.set(s.points, list);
  }

  const pointBrackets = [...buckets.keys()].sort((a, b) => b - a);
  const pool: StandingRow[] = [];
  for (const pts of pointBrackets) {
    pool.push(...shuffle(buckets.get(pts)!));
  }

  while (pool.length > 0) {
    const current = pool.shift()!;
    if (paired.has(current.userId)) continue;

    let partnerIdx = -1;
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      if (paired.has(candidate.userId)) continue;
      if (!hasPlayed(current.userId, candidate.userId, previous)) {
        partnerIdx = i;
        break;
      }
    }

    if (partnerIdx === -1) {
      for (let i = 0; i < pool.length; i++) {
        if (!paired.has(pool[i].userId)) {
          partnerIdx = i;
          break;
        }
      }
    }

    if (partnerIdx === -1) {
      pairings.push({
        player1Id: current.userId,
        player2Id: null,
        tableNumber: table++,
      });
      paired.add(current.userId);
      continue;
    }

    const partner = pool.splice(partnerIdx, 1)[0];
    pairings.push({
      player1Id: current.userId,
      player2Id: partner.userId,
      tableNumber: table++,
    });
    paired.add(current.userId);
    paired.add(partner.userId);
  }

  return pairings;
}

export function generatePairingsForRound(
  playerIds: number[],
  round: number,
  allMatches: MatchRecord[],
): PairingInsert[] {
  if (playerIds.length < 2) {
    if (playerIds.length === 1) {
      return [{ player1Id: playerIds[0], player2Id: null, tableNumber: 1 }];
    }
    return [];
  }

  if (round === 1) {
    return pairRoundOne(playerIds);
  }

  const priorMatches = allMatches.filter((m) => m.round < round);
  const standings = computeStandings(playerIds, priorMatches);
  return pairSwissRound(standings);
}

export type ManualPairingValidation = {
  valid: boolean;
  error?: string;
  warnings: string[];
};

export function validateManualPairings(
  playerIds: number[],
  pairings: PairingInsert[],
  priorMatches: MatchRecord[] = [],
): ManualPairingValidation {
  const warnings: string[] = [];
  const active = new Set(playerIds);
  const seen = new Set<number>();

  if (!playerIds.length) {
    return { valid: false, error: "No active players to pair", warnings };
  }

  if (!pairings.length) {
    return { valid: false, error: "At least one table is required", warnings };
  }

  for (const p of pairings) {
    if (!active.has(p.player1Id)) {
      return { valid: false, error: `Unknown or dropped player at table ${p.tableNumber}`, warnings };
    }
    if (seen.has(p.player1Id)) {
      return { valid: false, error: "A player appears in more than one table", warnings };
    }
    seen.add(p.player1Id);

    if (p.player2Id != null) {
      if (!active.has(p.player2Id)) {
        return { valid: false, error: `Unknown or dropped opponent at table ${p.tableNumber}`, warnings };
      }
      if (p.player1Id === p.player2Id) {
        return { valid: false, error: "A player cannot be paired against themselves", warnings };
      }
      if (seen.has(p.player2Id)) {
        return { valid: false, error: "A player appears in more than one table", warnings };
      }
      seen.add(p.player2Id);

      const rematch = priorMatches.some(
        (m) =>
          m.player2Id &&
          ((m.player1Id === p.player1Id && m.player2Id === p.player2Id) ||
            (m.player1Id === p.player2Id && m.player2Id === p.player1Id)),
      );
      if (rematch) {
        warnings.push(`Table ${p.tableNumber}: rematch`);
      }
    }
  }

  const missing = playerIds.filter((id) => !seen.has(id));
  if (missing.length) {
    return {
      valid: false,
      error: `${missing.length} active player(s) are not assigned to a table`,
      warnings,
    };
  }

  const byeCount = pairings.filter((p) => p.player2Id == null).length;
  if (byeCount > 1) {
    return { valid: false, error: "Only one BYE is allowed per round", warnings };
  }

  return { valid: true, warnings };
}

export function normalizeManualPairings(
  pairings: PairingInsert[],
): PairingInsert[] {
  return pairings.map((p, index) => ({
    player1Id: p.player1Id,
    player2Id: p.player2Id,
    tableNumber: p.tableNumber > 0 ? p.tableNumber : index + 1,
  }));
}
