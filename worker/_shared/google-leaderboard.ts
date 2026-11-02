const SHEET_ID = "186xE3qYmCdJeMQpmXXO7UqPL8ER2FUFos-K5OFWWtVQ";
const SHEET_GID = "1845835181";

const CORE_COLUMNS = new Set([
  "#",
  "Player Name",
  "Total",
  "Top 4 Livello 2",
  "Leagues S1",
  "Leagues S2",
]);

type GvizCell = { v?: string | number | null };
type GvizRow = { c: (GvizCell | null)[] };
type GvizCol = { label?: string; id?: string };
type GvizResponse = {
  table: {
    cols: GvizCol[];
    rows: GvizRow[];
  };
};

export type LeaderboardEventScore = {
  key: string;
  label: string;
  value: string | number | null;
};

export type LeaderboardPlayer = {
  rank: number;
  playerName: string;
  total: number;
  top4Livello2: string | number | null;
  leaguesS1: string | number | null;
  leaguesS2: string | number | null;
  events: LeaderboardEventScore[];
};

export type ParsedLeaderboard = {
  title: string;
  sourceUrl: string;
  syncedAt: string;
  eventColumns: { key: string; label: string }[];
  players: LeaderboardPlayer[];
};

let cache: { data: ParsedLeaderboard; expiresAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

function parseGvizJson(text: string): GvizResponse {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Invalid Google Sheets response");
  return JSON.parse(match[0]) as GvizResponse;
}

function colKey(label: string, index: number): string {
  return label.replace(/\s+/g, " ").trim() || `col_${index}`;
}

function isEventColumn(label: string): boolean {
  if (!label || CORE_COLUMNS.has(label)) return false;
  if (/^[A-Z]{1,3}$/.test(label)) return false;
  return true;
}

function cellValue(cell: GvizCell | null | undefined): string | number | null {
  const v = cell?.v;
  if (v === undefined || v === null || v === "") return null;
  return v;
}

export async function fetchItalianLeaderboard(): Promise<ParsedLeaderboard> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&gid=${SHEET_GID}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "CentCompanion/1.0" },
  });
  if (!res.ok) throw new Error("Failed to fetch leaderboard from Google Sheets");

  const json = parseGvizJson(await res.text());
  const cols = json.table.cols;

  const eventColumns = cols
    .map((col, index) => ({ label: col.label ?? "", index }))
    .filter(({ label }) => isEventColumn(label))
    .map(({ label, index }) => ({ key: colKey(label, index), label: label.trim() }));

  const players: LeaderboardPlayer[] = [];

  for (const row of json.table.rows) {
    const get = (label: string) => {
      const idx = cols.findIndex((c) => c.label === label);
      return idx >= 0 ? cellValue(row.c[idx]) : null;
    };

    const rankRaw = get("#");
    const playerName = get("Player Name");
    const totalRaw = get("Total");

    if (typeof playerName !== "string" || !playerName.trim()) continue;
    const rank = typeof rankRaw === "number" ? rankRaw : Number(rankRaw);
    if (!Number.isFinite(rank)) continue;

    const total = typeof totalRaw === "number" ? totalRaw : Number(totalRaw);
    if (!Number.isFinite(total)) continue;

    const events: LeaderboardEventScore[] = eventColumns.map(({ key, label }) => {
      const colIndex = cols.findIndex((c) => (c.label ?? "").trim() === label);
      return {
        key,
        label,
        value: colIndex >= 0 ? cellValue(row.c[colIndex]) : null,
      };
    });

    players.push({
      rank,
      playerName: playerName.trim(),
      total,
      top4Livello2: get("Top 4 Livello 2"),
      leaguesS1: get("Leagues S1"),
      leaguesS2: get("Leagues S2"),
      events,
    });
  }

  // Order by points; ignore sheet "#" when it disagrees with Total.
  players.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.playerName.localeCompare(b.playerName);
  });
  players.forEach((p, i) => {
    p.rank = i + 1;
  });

  const data: ParsedLeaderboard = {
    title: "Italian Leaderboard 2026",
    sourceUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}`,
    syncedAt: new Date().toISOString(),
    eventColumns,
    players,
  };

  cache = { data, expiresAt: Date.now() + CACHE_MS };
  return data;
}

export function findPlayerByName(
  players: LeaderboardPlayer[],
  names: (string | null | undefined)[],
): LeaderboardPlayer | null {
  const normalized = names
    .filter(Boolean)
    .map((n) => n!.trim().toLowerCase());

  return (
    players.find((p) => {
      const player = p.playerName.toLowerCase();
      return normalized.some(
        (n) => player === n || player.includes(n) || n.includes(player),
      );
    }) ?? null
  );
}
