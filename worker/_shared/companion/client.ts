/**
 * MTG Companion / EventLink client ΓÇö ported from PullCompanionResults/companion_client.py
 * Credentials are used only for the request; never persist them.
 */

const PLATFORM_TOKEN_URL = "https://api.platform.wizards.com/auth/oauth/token";
const PLATFORM_LOGIN_BASIC = "TnpuU2h3S21MUE1FcllrZnV2eXluZkE5OnIyUmd4ODlhQ0ZUZmpiajdUVTU5c0w4cQ==";
const EXCHANGE_BASIC = "V0pSWURITkdST0laSEw4QjpWNVZYSzZGTEcxWUkwR0QyWFkzSA==";
const EXCHANGE_GAME_IDS = ["companion", "eventreporter"] as const;
const GRAPHQL_URL = "https://api.tabletop.wizards.com/silverbeak-griffin-service/graphql";
const SHORT_CODE_URL =
  "https://api.tabletop.wizards.com/event-reservations-service/events/short-code/{code}";

const GAME_STATE_QUERY = `
query getGameStateAtRound($eventId: ID!, $round: Int!) {
  gameStateV2AtRound(eventId: $eventId, round: $round) {
    eventId
    currentRoundNumber
    teams {
      teamId
      teamName
      players {
        firstName
        lastName
        displayName
      }
    }
    rounds {
      roundNumber
      isCertified
      isFinalRound
      isPlayoff
      pairingStrategy
      matches {
        matchId
        isBye
        tableNumber
        teamIds
        results {
          teamId
          wins
          losses
          draws
          isBye
        }
      }
      standings {
        teamId
        rank
        wins
        losses
        draws
        matchPoints
        gameWinPercent
        opponentGameWinPercent
        opponentMatchWinPercent
      }
    }
  }
}
`;

const EVENT_DETAILS_QUERY = `
query eventDetails($id: ID!) {
  event(id: $id) {
    id
    title
    shortCode
    status
  }
}
`;

const MY_ACTIVE_EVENTS_QUERY = `
query {
  myActiveEvents {
    id
    title
    shortCode
    status
  }
}
`;

export class CompanionApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionApiError";
  }
}

export type CompanionStanding = {
  teamId?: string;
  rank: number;
  firstName: string;
  lastName: string;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  matchPoints: number;
  gameWinPercent: number | null;
  opponentMatchWinPercent: number | null;
};

export type CompanionEventInfo = {
  id: string;
  title: string;
  shortCode: string;
  status: string | null;
};

type Team = {
  teamId?: string;
  teamName?: string | null;
  players?: Array<{
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
  }>;
};

type RoundStanding = {
  teamId?: string;
  rank?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  matchPoints?: number;
  gameWinPercent?: number | null;
  opponentMatchWinPercent?: number | null;
};

type MatchResult = {
  teamId?: string;
  wins?: number;
  losses?: number;
  draws?: number;
  isBye?: boolean;
};

type RoundMatch = {
  matchId?: string;
  isBye?: boolean;
  tableNumber?: number;
  teamIds?: string[];
  results?: MatchResult[];
};

type RoundData = {
  roundNumber?: number;
  isCertified?: boolean;
  standings?: RoundStanding[];
  matches?: RoundMatch[];
};

type GameState = {
  eventId?: string;
  currentRoundNumber?: number;
  teams?: Team[];
  rounds?: RoundData[];
};

export type CompanionMatchRow = {
  round: number;
  tableNumber?: number;
  player1Name: string;
  player2Name: string | null;
  player1Games?: number;
  player2Games?: number;
  result: "p1_win" | "p2_win" | "draw" | "pending" | "bye";
  teamId1?: string;
  teamId2?: string | null;
  isBye: boolean;
};

export type CompanionTournamentResults = {
  standings: CompanionStanding[];
  matches: CompanionMatchRow[];
};

async function readDetail(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as Record<string, unknown>;
    return String(
      payload.error_description || payload.error || payload.message || JSON.stringify(payload),
    );
  } catch {
    const text = (await res.text()).trim();
    return text || `HTTP ${res.status}`;
  }
}

class WizardsAuth {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt = 0;

  constructor(
    private email: string,
    private password: string,
  ) {}

  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() / 1000 < this.expiresAt) return this.accessToken;
    if (this.refreshToken) await this.refresh();
    else await this.login();
    if (!this.accessToken) throw new CompanionApiError("Authentication failed: no access token received.");
    return this.accessToken;
  }

  private async login() {
    const res = await fetch(PLATFORM_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${PLATFORM_LOGIN_BASIC}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "password",
        username: this.email,
        password: this.password,
      }),
    });
    await this.applyPlatformToken(res);
  }

  private async refresh() {
    const res = await fetch(PLATFORM_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${PLATFORM_LOGIN_BASIC}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
      }),
    });
    if (res.status >= 400) {
      await this.login();
      return;
    }
    await this.applyPlatformToken(res);
  }

  private async applyPlatformToken(res: Response) {
    if (res.status >= 400) {
      throw new CompanionApiError(`Wizards login failed: ${await readDetail(res)}`);
    }
    const payload = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!payload.access_token) {
      throw new CompanionApiError(
        `Wizards login failed: ${payload.error_description || payload.error || "unknown error"}`,
      );
    }
    this.refreshToken = payload.refresh_token ?? this.refreshToken;
    this.accessToken = await this.exchangeForTabletopToken(payload.access_token);
    const expiresIn = payload.expires_in ?? 3600;
    this.expiresAt = Date.now() / 1000 + Math.max(expiresIn - 30, 60);
  }

  private async exchangeForTabletopToken(platformToken: string): Promise<string> {
    let lastError = "Unknown authentication error.";
    for (const gameId of EXCHANGE_GAME_IDS) {
      const nonceRes = await fetch(`https://api.platform.wizards.com/exchange/gameID/${gameId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${platformToken}` },
      });
      if (nonceRes.status >= 400) {
        lastError = await readDetail(nonceRes);
        continue;
      }
      const noncePayload = (await nonceRes.json()) as { nonce?: string };
      if (!noncePayload.nonce) {
        lastError = `Missing nonce for gameID '${gameId}'.`;
        continue;
      }
      const tokenRes = await fetch(PLATFORM_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${EXCHANGE_BASIC}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grant_type: "exchange", ticket: noncePayload.nonce }),
      });
      if (tokenRes.status >= 400) {
        lastError = await readDetail(tokenRes);
        continue;
      }
      const tokenPayload = (await tokenRes.json()) as { access_token?: string };
      if (tokenPayload.access_token) return tokenPayload.access_token;
      lastError = JSON.stringify(tokenPayload);
    }
    throw new CompanionApiError(`Could not obtain Companion/EventLink token: ${lastError}`);
  }
}

function extractEventId(payload: unknown): string | null {
  if (typeof payload === "boolean") return null;
  if (typeof payload === "number" || typeof payload === "string") {
    const text = String(payload).trim();
    return text || null;
  }
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  for (const key of ["id", "eventId", "eventID"]) {
    const value = obj[key];
    if (value != null && value !== "") return String(value);
  }
  if (obj.event != null) return extractEventId(obj.event);
  return null;
}

function latestStandings(rounds: RoundData[]): RoundStanding[] {
  const certified = rounds.filter((r) => r.isCertified && r.standings?.length);
  const source =
    certified[certified.length - 1] ??
    [...rounds].reverse().find((r) => r.standings?.length);
  return source?.standings ?? [];
}

function teamDisplayName(team: Team | undefined): string {
  if (!team) return "Unknown";
  const players = team.players ?? [];
  const displayNames = players.map((p) => p.displayName || "").filter(Boolean);
  if (displayNames.length) return displayNames.join(" / ");
  const firstNames = players.map((p) => p.firstName || "").filter(Boolean);
  const lastNames = players.map((p) => p.lastName || "").filter(Boolean);
  const composed = firstNames.map((f, i) => [f, lastNames[i]].filter(Boolean).join(" ")).filter(Boolean);
  if (composed.length) return composed.join(" / ");
  return team.teamName || "Unknown";
}

function enrichStanding(standing: RoundStanding, teams: Record<string, Team>): CompanionStanding {
  const team = teams[standing.teamId ?? ""] ?? {};
  const players = team.players ?? [];
  const firstNames = players.map((p) => p.firstName || "").filter(Boolean);
  const lastNames = players.map((p) => p.lastName || "").filter(Boolean);
  const displayNames = players.map((p) => p.displayName || "").filter(Boolean);

  return {
    teamId: standing.teamId,
    rank: standing.rank ?? 9999,
    firstName: firstNames.join(" / ") || team.teamName || "Unknown",
    lastName: lastNames.join(" / "),
    displayName: displayNames.join(" / "),
    wins: standing.wins ?? 0,
    losses: standing.losses ?? 0,
    draws: standing.draws ?? 0,
    matchPoints: standing.matchPoints ?? 0,
    gameWinPercent: standing.gameWinPercent ?? null,
    opponentMatchWinPercent: standing.opponentMatchWinPercent ?? null,
  };
}

function buildMatches(rounds: RoundData[], teams: Record<string, Team>): CompanionMatchRow[] {
  const matches: CompanionMatchRow[] = [];
  for (const round of rounds) {
    const roundNumber = round.roundNumber ?? 0;
    for (const m of round.matches ?? []) {
      const teamIds = m.teamIds ?? [];
      const teamId1 = teamIds[0];
      const teamId2 = teamIds[1] ?? null;
      const isBye = Boolean(m.isBye || !teamId2);
      const results = m.results ?? [];
      const r1 = results.find((r) => r.teamId === teamId1);
      const r2 = teamId2 ? results.find((r) => r.teamId === teamId2) : undefined;
      const p1Games = r1?.wins;
      const p2Games = r2?.wins;

      let result: CompanionMatchRow["result"] = "pending";
      if (isBye) result = "bye";
      else if (p1Games != null && p2Games != null) {
        if (p1Games > p2Games) result = "p1_win";
        else if (p2Games > p1Games) result = "p2_win";
        else result = "draw";
      }

      matches.push({
        round: roundNumber,
        tableNumber: m.tableNumber,
        player1Name: teamDisplayName(teams[teamId1 ?? ""]),
        player2Name: isBye ? null : teamDisplayName(teams[teamId2 ?? ""]),
        player1Games: p1Games,
        player2Games: p2Games,
        result,
        teamId1,
        teamId2,
        isBye,
      });
    }
  }
  return matches;
}

export class CompanionClient {
  private auth: WizardsAuth;

  constructor(email: string, password: string) {
    this.auth = new WizardsAuth(email, password);
  }

  private async headers(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.auth.getToken()}`,
      "Content-Type": "application/json",
      "x-wotc-client": "client:companion version:00000000 platform:cloudflare/worker",
    };
  }

  private async graphql(query: string, variables: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify({ query, variables }),
    });
    if (res.status >= 400) {
      throw new CompanionApiError(`GraphQL request failed: ${await readDetail(res)}`);
    }
    const payload = (await res.json()) as {
      errors?: Array<{ message?: string }>;
      data?: Record<string, unknown>;
    };
    if (payload.errors?.length) {
      throw new CompanionApiError(payload.errors.map((e) => e.message ?? String(e)).join("; "));
    }
    return payload.data ?? {};
  }

  async resolveEventByShortCode(shortCode: string): Promise<CompanionEventInfo> {
    const normalized = shortCode.trim().toUpperCase();
    const res = await fetch(SHORT_CODE_URL.replace("{code}", normalized), {
      headers: await this.headers(),
    });
    if (res.status === 404) return this.resolveFromActiveEvents(normalized);
    if (res.status >= 400) {
      if (res.status === 401) {
        throw new CompanionApiError(
          "Authentication failed. Check your Wizards account email and password.",
        );
      }
      throw new CompanionApiError(`Could not resolve event code '${normalized}': ${await readDetail(res)}`);
    }

    const payload = await res.json();
    const eventId = extractEventId(payload);
    if (!eventId) {
      throw new CompanionApiError(`Event code '${normalized}' was found, but no event id was returned.`);
    }

    const details = (await this.graphql(EVENT_DETAILS_QUERY, { id: eventId })).event as
      | CompanionEventInfo
      | undefined;

    return {
      id: eventId,
      title: details?.title || "Unknown event",
      shortCode: details?.shortCode || normalized,
      status: details?.status ?? null,
    };
  }

  private async resolveFromActiveEvents(shortCode: string): Promise<CompanionEventInfo> {
    const data = await this.graphql(MY_ACTIVE_EVENTS_QUERY, {});
    const events = (data.myActiveEvents as CompanionEventInfo[]) || [];
    const match = events.find((e) => (e.shortCode || "").toUpperCase() === shortCode);
    if (!match) {
      throw new CompanionApiError(
        `No event found for code '${shortCode}'. Make sure the code is correct and that your account can access the event.`,
      );
    }
    return match;
  }

  private async loadMergedGameState(eventId: string): Promise<{
    teams: Record<string, Team>;
    rounds: RoundData[];
  } | null> {
    const first = (
      (await this.graphql(GAME_STATE_QUERY, { eventId, round: 1 })).gameStateV2AtRound as GameState | undefined
    );
    if (!first) return null;

    const currentRound = first.currentRoundNumber || 1;
    const teams: Record<string, Team> = {};
    const mergedRounds = new Map<number, RoundData>();

    // Reuse round-1 payload, then fetch remaining rounds only once each.
    const states: Array<GameState | undefined> = [first];
    for (let roundNumber = 2; roundNumber <= Math.max(currentRound, 1); roundNumber += 1) {
      states.push(
        (await this.graphql(GAME_STATE_QUERY, { eventId, round: roundNumber })).gameStateV2AtRound as
          | GameState
          | undefined,
      );
    }

    for (const gameState of states) {
      if (!gameState) continue;
      for (const team of gameState.teams || []) {
        if (team.teamId) teams[team.teamId] = team;
      }
      for (const roundData of gameState.rounds || []) {
        const key = roundData.roundNumber;
        if (key == null) continue;
        const existing = mergedRounds.get(key);
        if (!existing || (roundData.matches?.length ?? 0) >= (existing.matches?.length ?? 0)) {
          mergedRounds.set(key, roundData);
        }
      }
    }

    const rounds = [...mergedRounds.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, round]) => round);

    return { teams, rounds };
  }

  async fetchTournamentStandings(eventId: string): Promise<CompanionStanding[]> {
    const { standings } = await this.fetchTournamentResults(eventId);
    return standings;
  }

  async fetchTournamentResults(eventId: string): Promise<CompanionTournamentResults> {
    const merged = await this.loadMergedGameState(eventId);
    if (!merged) return { standings: [], matches: [] };

    const standings = latestStandings(merged.rounds)
      .map((s) => enrichStanding(s, merged.teams))
      .sort((a, b) => a.rank - b.rank);

    return {
      standings,
      matches: buildMatches(merged.rounds, merged.teams),
    };
  }
}

/** Split Companion multi-player "A / B" names to primary player for 1v1 matching. */
export function primaryCompanionName(full: string): string {
  return full.split(" / ")[0]?.trim() || full.trim();
}
