/**
 * WotC Magic Companion / EventLink results pull.
 * Uses CompanionClient (Wizards email/password → tabletop token → GraphQL).
 */
import { getEnv } from "../../runtime";
import {
  CompanionApiError,
  CompanionClient,
  type CompanionMatchRow,
  type CompanionStanding,
} from "./client";

export type CompanionPlayer = {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  wins?: number;
  losses?: number;
  draws?: number;
  matchPoints?: number;
  teamId?: string;
};

export type CompanionMatch = CompanionMatchRow;

export type CompanionEventPayload = {
  eventId: string;
  eventCode: string;
  title?: string;
  status?: string;
  players: CompanionPlayer[];
  matches: CompanionMatch[];
  standings: CompanionStanding[];
};

const inFlight = new Map<string, Promise<CompanionEventPayload>>();

function resolveCredentials(creds?: { email: string; password: string }): { email: string; password: string } {
  if (creds?.email?.trim() && creds.password) {
    return { email: creds.email.trim(), password: creds.password };
  }
  const env = getEnv() as {
    COMPANION_EMAIL?: string;
    COMPANION_PASSWORD?: string;
  };
  if (env.COMPANION_EMAIL?.trim() && env.COMPANION_PASSWORD) {
    return { email: env.COMPANION_EMAIL.trim(), password: env.COMPANION_PASSWORD };
  }
  throw new CompanionApiError(
    "Wizards credentials required. Provide wizardsEmail/wizardsPassword on pull, or set COMPANION_EMAIL and COMPANION_PASSWORD.",
  );
}

/** Normalize display names for matching registrations. */
export function normalizeCompanionName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch event by public Companion event code.
 * Credentials from arg, else env COMPANION_EMAIL / COMPANION_PASSWORD.
 */
export async function pullCompanionEventByCode(
  eventCode: string,
  creds?: { email: string; password: string },
): Promise<CompanionEventPayload> {
  const code = eventCode.trim().toUpperCase();
  const existing = inFlight.get(code);
  if (existing) return existing;

  const promise = (async () => {
    const { email, password } = resolveCredentials(creds);
    const client = new CompanionClient(email, password);
    const event = await client.resolveEventByShortCode(code);
    const { standings, matches } = await client.fetchTournamentResults(event.id);

    const players: CompanionPlayer[] = standings.map((s) => ({
      id: s.teamId || `rank-${s.rank}`,
      displayName: s.displayName || [s.firstName, s.lastName].filter(Boolean).join(" ") || "Unknown",
      firstName: s.firstName,
      lastName: s.lastName,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      matchPoints: s.matchPoints,
      teamId: s.teamId,
    }));

    return {
      eventId: event.id,
      eventCode: event.shortCode || code,
      title: event.title,
      status: event.status ?? undefined,
      players,
      matches,
      standings,
    };
  })();

  inFlight.set(code, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(code);
  }
}

export { CompanionApiError };
