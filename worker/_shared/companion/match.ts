import { namesMatch, normalizeName } from "../registrations";
import { primaryCompanionName, type CompanionStanding } from "./client";

export type LocalRegistrationForMatch = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  moxfieldUrl: string | null;
  deckName: string | null;
  registrationStatus: string;
  companionTeamId: string | null;
};

export type MatchedCompanionStanding = CompanionStanding & {
  registrationId: number | null;
  matchedEmail: string | null;
  moxfieldUrl: string | null;
  deckName: string | null;
  matchQuality: "team" | "exact" | "unmatched";
};

function statusRank(status: string): number {
  if (status === "confirmed") return 0;
  if (status === "waitlisted") return 1;
  return 2;
}

/**
 * Pair Companion standings to local registrations.
 * 1) Prefer persisted companionTeamId links
 * 2) Fall back to first+last name
 * Email is attached from the matched account when available.
 */
export function matchCompanionStandings(
  standings: CompanionStanding[],
  registrations: LocalRegistrationForMatch[],
): MatchedCompanionStanding[] {
  const used = new Set<number>();

  return standings.map((standing) => {
    const first = primaryCompanionName(standing.firstName);
    const last = primaryCompanionName(standing.lastName);
    const teamId = standing.teamId?.trim() || null;

    let match: LocalRegistrationForMatch | null = null;
    let matchQuality: MatchedCompanionStanding["matchQuality"] = "unmatched";

    if (teamId) {
      const byTeam = registrations.find(
        (reg) => !used.has(reg.id) && reg.companionTeamId && reg.companionTeamId === teamId,
      );
      if (byTeam) {
        match = byTeam;
        matchQuality = "team";
      }
    }

    if (!match) {
      const candidates = registrations
        .filter(
          (reg) =>
            !used.has(reg.id) &&
            namesMatch(reg.firstName, first) &&
            namesMatch(reg.lastName, last),
        )
        .sort((a, b) => {
          const byStatus = statusRank(a.registrationStatus) - statusRank(b.registrationStatus);
          if (byStatus !== 0) return byStatus;
          return (b.email ? 1 : 0) - (a.email ? 1 : 0);
        });

      match = candidates[0] ?? null;

      if (!match && !normalizeName(last)) {
        const full = normalizeName(`${first}`).toLowerCase();
        const byFull = registrations
          .filter((reg) => !used.has(reg.id))
          .filter((reg) => {
            const localFull = normalizeName(`${reg.firstName} ${reg.lastName}`).toLowerCase();
            return localFull === full || namesMatch(reg.firstName, first);
          })
          .sort((a, b) => statusRank(a.registrationStatus) - statusRank(b.registrationStatus));
        match = byFull[0] ?? null;
      }

      if (match) matchQuality = "exact";
    }

    if (match) used.add(match.id);

    return {
      ...standing,
      firstName: first,
      lastName: last || standing.lastName,
      registrationId: match?.id ?? null,
      matchedEmail: match?.email ?? null,
      moxfieldUrl: match?.moxfieldUrl ?? null,
      deckName: match?.deckName ?? null,
      matchQuality,
    };
  });
}

export function percentToInt(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 10000);
}

export function intToPercent(value: number | null | undefined): number | null {
  if (value == null) return null;
  return value / 10000;
}
