import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { companionStandings, eventRegistrations, events, matches, users } from "../../db/schema";
import { error, getAuthUser, json, type RouteParams } from "../_shared/auth";
import { CompanionApiError } from "../_shared/companion/client";
import {
  intToPercent,
  matchCompanionStandings,
  percentToInt,
  type MatchedCompanionStanding,
} from "../_shared/companion/match";
import {
  normalizeCompanionName,
  pullCompanionEventByCode,
} from "../_shared/companion/pull";
import { resolveEventPermissions } from "../_shared/event-permissions";
import { activatePhase, ensureInitialPhase } from "../_shared/phases";
import { formatPlayerName, normalizeName, ensureGuestPlayersForPairings } from "../_shared/registrations";

const pullSchema = z.object({
  code: z.string().min(3).max(16).optional(),
  wizardsEmail: z.string().email().optional(),
  wizardsPassword: z.string().min(1).optional(),
  markCompleted: z.boolean().optional().default(true),
});

const moxfieldSchema = z.object({
  registrationId: z.number().int().positive(),
  moxfieldUrl: z
    .union([
      z
        .string()
        .url()
        .refine((u) => u.includes("moxfield.com"), { message: "Must be a Moxfield deck URL" }),
      z.literal(""),
      z.null(),
    ])
    .transform((v) => (v && String(v).trim() ? String(v).trim() : null)),
  deckName: z.string().max(255).optional().nullable(),
});

const remapSchema = z.object({
  links: z
    .array(
      z.object({
        standingId: z.number().int().positive(),
        registrationId: z.number().int().positive().nullable(),
      }),
    )
    .min(1),
});

function mapReportRow(
  row: typeof companionStandings.$inferSelect,
  reg: {
    moxfieldUrl: string | null;
    deckName: string | null;
    firstName: string;
    lastName: string;
  } | null,
) {
  return {
    id: row.id,
    rank: row.rank,
    registrationId: row.registrationId,
    companionTeamId: row.companionTeamId,
    firstName: row.firstName,
    lastName: row.lastName,
    displayName: row.displayName || formatPlayerName(row.firstName, row.lastName) || "Unknown",
    matchedEmail: row.matchedEmail,
    matched: row.registrationId != null,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    matchPoints: row.matchPoints,
    gameWinPercent: intToPercent(row.gameWinPercent),
    opponentMatchWinPercent: intToPercent(row.opponentMatchWinPercent),
    moxfieldUrl: reg?.moxfieldUrl ?? null,
    deckName: reg?.deckName ?? null,
    registrationName: reg ? formatPlayerName(reg.firstName, reg.lastName) : null,
  };
}

async function loadReport(eventId: number) {
  const db = getDb();
  return db
    .select({
      standing: companionStandings,
      moxfieldUrl: eventRegistrations.moxfieldUrl,
      deckName: eventRegistrations.deckName,
      regFirstName: eventRegistrations.firstName,
      regLastName: eventRegistrations.lastName,
    })
    .from(companionStandings)
    .leftJoin(eventRegistrations, eq(companionStandings.registrationId, eventRegistrations.id))
    .where(eq(companionStandings.eventId, eventId))
    .orderBy(asc(companionStandings.rank));
}

function mapRows(rows: Awaited<ReturnType<typeof loadReport>>) {
  return rows.map((r) =>
    mapReportRow(
      r.standing,
      r.regFirstName
        ? {
            moxfieldUrl: r.moxfieldUrl,
            deckName: r.deckName,
            firstName: r.regFirstName,
            lastName: r.regLastName ?? "",
          }
        : null,
    ),
  );
}

async function loadOrganizerRegistrations(eventId: number) {
  const db = getDb();
  const rows = await db
    .select({
      id: eventRegistrations.id,
      firstName: eventRegistrations.firstName,
      lastName: eventRegistrations.lastName,
      moxfieldUrl: eventRegistrations.moxfieldUrl,
      deckName: eventRegistrations.deckName,
      registrationStatus: eventRegistrations.registrationStatus,
      companionTeamId: eventRegistrations.companionTeamId,
      email: users.email,
      isGuest: eventRegistrations.isGuest,
    })
    .from(eventRegistrations)
    .leftJoin(users, eq(eventRegistrations.userId, users.id))
    .where(eq(eventRegistrations.eventId, eventId))
    .orderBy(asc(eventRegistrations.lastName), asc(eventRegistrations.firstName));

  return rows.map((r) => ({
    id: r.id,
    displayName: formatPlayerName(r.firstName, r.lastName),
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    moxfieldUrl: r.moxfieldUrl,
    deckName: r.deckName,
    registrationStatus: r.registrationStatus,
    companionTeamId: r.companionTeamId,
    isGuest: r.isGuest,
  }));
}

async function persistTeamLinks(
  eventId: number,
  matched: Array<Pick<MatchedCompanionStanding, "registrationId" | "teamId">>,
) {
  const db = getDb();
  const links = matched.filter((m) => m.registrationId && m.teamId);
  const linkedRegIds = new Set(links.map((m) => m.registrationId!));
  const teamIds = [...new Set(links.map((m) => m.teamId!))];

  if (teamIds.length) {
    await db
      .update(eventRegistrations)
      .set({ companionTeamId: null, updatedAt: new Date() })
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          inArray(eventRegistrations.companionTeamId, teamIds),
          linkedRegIds.size
            ? sql`${eventRegistrations.id} not in (${sql.join(
                [...linkedRegIds].map((id) => sql`${id}`),
                sql`, `,
              )})`
            : sql`true`,
        ),
      );
  }

  // One round-trip per link is too expensive on Workers (Neon HTTP = 1 subrequest each).
  // Apply links in a single UPDATE … FROM (VALUES …) statement.
  if (links.length) {
    const values = sql.join(
      links.map((link) => sql`(${link.registrationId}::int, ${link.teamId!}::text)`),
      sql`, `,
    );
    await db.execute(sql`
      update event_registrations as r
      set companion_team_id = v.team_id,
          updated_at = now()
      from (values ${values}) as v(registration_id, team_id)
      where r.id = v.registration_id and r.event_id = ${eventId}
    `);
  }
}

function dbErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Companion pull failed";
  const withCause = err as Error & {
    cause?: { message?: string; detail?: string; code?: string } | string;
  };
  const cause = withCause.cause;
  if (cause && typeof cause === "object") {
    const parts = [cause.message, cause.detail, cause.code ? `code ${cause.code}` : null].filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  if (typeof cause === "string" && cause.trim()) return cause;
  return err.message || "Companion pull failed";
}

function asGameCount(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(2, Math.trunc(value)));
}

export async function handleEventsCompanion(req: Request, params: RouteParams): Promise<Response> {
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return error("Event not found", 404);

  const authUser = await getAuthUser(req);

  if (req.method === "GET") {
    if (
      event.approvalStatus !== "approved" &&
      (!authUser || (authUser.role !== "admin" && authUser.id !== event.organizerId))
    ) {
      return error("Event not available", 404);
    }

    const perms = authUser ? await resolveEventPermissions(authUser, event) : null;
    const isOrganizer = Boolean(perms?.canManage);
    const rows = await loadReport(eventId);

    return json({
      opsMode: event.opsMode,
      companionEventCode: event.companionEventCode,
      companionLastPulledAt: event.companionLastPulledAt,
      companionPullStatus: event.companionPullStatus,
      isOrganizer,
      standings: mapRows(rows),
      registrations: isOrganizer ? await loadOrganizerRegistrations(eventId) : [],
    });
  }

  if (req.method === "POST") {
    if (!authUser) return error("Unauthorized", 401);
    const perms = await resolveEventPermissions(authUser, event);
    if (!perms.canManage) return error("Forbidden", 403);

    const action = new URL(req.url).searchParams.get("action") || "";

    if (action === "update-moxfield") {
      const body = moxfieldSchema.safeParse(await req.json());
      if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

      const [reg] = await db
        .select()
        .from(eventRegistrations)
        .where(eq(eventRegistrations.id, body.data.registrationId))
        .limit(1);
      if (!reg || reg.eventId !== eventId) return error("Registration not found", 404);

      const [updated] = await db
        .update(eventRegistrations)
        .set({
          moxfieldUrl: body.data.moxfieldUrl,
          ...(body.data.deckName !== undefined ? { deckName: body.data.deckName } : {}),
          updatedAt: new Date(),
        })
        .where(eq(eventRegistrations.id, reg.id))
        .returning();

      return json({
        registration: {
          id: updated.id,
          moxfieldUrl: updated.moxfieldUrl,
          deckName: updated.deckName,
        },
      });
    }

    if (action === "remap") {
      const body = remapSchema.safeParse(await req.json());
      if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

      const standingIds = body.data.links.map((l) => l.standingId);
      const standingsRows = await db
        .select()
        .from(companionStandings)
        .where(
          and(eq(companionStandings.eventId, eventId), inArray(companionStandings.id, standingIds)),
        );

      if (standingsRows.length !== standingIds.length) {
        return error("One or more standings were not found for this event", 404);
      }

      const standingById = new Map(standingsRows.map((s) => [s.id, s]));
      const regIds = body.data.links
        .map((l) => l.registrationId)
        .filter((id): id is number => id != null);

      if (new Set(regIds).size !== regIds.length) {
        return error("Each registration can only be linked to one Companion standing");
      }

      if (regIds.length > 0) {
        const regs = await db
          .select()
          .from(eventRegistrations)
          .where(and(eq(eventRegistrations.eventId, eventId), inArray(eventRegistrations.id, regIds)));
        if (regs.length !== regIds.length) {
          return error("One or more registrations were not found for this event", 404);
        }
      }

      const emailByRegId = new Map<number, string | null>();
      if (regIds.length) {
        const withEmail = await db
          .select({ id: eventRegistrations.id, email: users.email })
          .from(eventRegistrations)
          .leftJoin(users, eq(eventRegistrations.userId, users.id))
          .where(and(eq(eventRegistrations.eventId, eventId), inArray(eventRegistrations.id, regIds)));
        for (const row of withEmail) emailByRegId.set(row.id, row.email);
      }

      const teamIdsToReassign = standingsRows
        .map((s) => s.companionTeamId)
        .filter((id): id is string => !!id);
      if (teamIdsToReassign.length) {
        await db
          .update(eventRegistrations)
          .set({ companionTeamId: null, updatedAt: new Date() })
          .where(
            and(
              eq(eventRegistrations.eventId, eventId),
              inArray(eventRegistrations.companionTeamId, teamIdsToReassign),
            ),
          );
      }

      const previousRegIds = standingsRows
        .map((s) => s.registrationId)
        .filter((id): id is number => id != null);
      if (previousRegIds.length) {
        await db
          .update(eventRegistrations)
          .set({ companionTeamId: null, updatedAt: new Date() })
          .where(
            and(
              eq(eventRegistrations.eventId, eventId),
              inArray(eventRegistrations.id, previousRegIds),
            ),
          );
      }

      for (const link of body.data.links) {
        const standing = standingById.get(link.standingId)!;
        await db
          .update(companionStandings)
          .set({
            registrationId: link.registrationId,
            matchedEmail: link.registrationId ? emailByRegId.get(link.registrationId) ?? null : null,
          })
          .where(eq(companionStandings.id, link.standingId));

        if (link.registrationId && standing.companionTeamId) {
          await db
            .update(eventRegistrations)
            .set({ companionTeamId: standing.companionTeamId, updatedAt: new Date() })
            .where(eq(eventRegistrations.id, link.registrationId));
        }
      }

      const rows = await loadReport(eventId);
      const mapped = mapRows(rows);
      return json({
        standings: mapped,
        registrations: await loadOrganizerRegistrations(eventId),
        matchedCount: mapped.filter((s) => s.matched).length,
        unmatchedCount: mapped.filter((s) => !s.matched).length,
      });
    }

    return error("Unknown action", 400);
  }

  return error("Method not allowed", 405);
}

export async function handleEventsCompanionPull(req: Request, params: RouteParams): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const db = getDb();
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return error("Event not found", 404);

  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);
  const perms = await resolveEventPermissions(authUser, event);
  if (!perms.canManage) return error("Forbidden", 403);

  const body = pullSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

  const code = (body.data.code ?? event.companionEventCode ?? "").trim().toUpperCase();
  if (!code) return error("Companion event code is required", 400);

  const creds =
    body.data.wizardsEmail && body.data.wizardsPassword
      ? { email: body.data.wizardsEmail, password: body.data.wizardsPassword }
      : undefined;

  await db
    .update(events)
    .set({
      companionEventCode: code,
      companionPullStatus: "pulling",
      opsMode: "companion_linked",
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  try {
    const payload = await pullCompanionEventByCode(code, creds);

    const regs = await db
      .select({
        id: eventRegistrations.id,
        userId: eventRegistrations.userId,
        firstName: eventRegistrations.firstName,
        lastName: eventRegistrations.lastName,
        moxfieldUrl: eventRegistrations.moxfieldUrl,
        deckName: eventRegistrations.deckName,
        registrationStatus: eventRegistrations.registrationStatus,
        companionTeamId: eventRegistrations.companionTeamId,
        email: users.email,
      })
      .from(eventRegistrations)
      .leftJoin(users, eq(eventRegistrations.userId, users.id))
      .where(eq(eventRegistrations.eventId, eventId));

    const matched = matchCompanionStandings(
      payload.standings,
      regs.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        moxfieldUrl: r.moxfieldUrl,
        deckName: r.deckName,
        registrationStatus: r.registrationStatus,
        companionTeamId: r.companionTeamId,
      })),
    );

    await persistTeamLinks(eventId, matched);

    await db.delete(companionStandings).where(eq(companionStandings.eventId, eventId));
    if (matched.length) {
      await db.insert(companionStandings).values(
        matched.map((row) => ({
          eventId,
          rank: row.rank,
          registrationId: row.registrationId,
          companionTeamId: row.teamId ?? null,
          firstName: row.firstName,
          lastName: row.lastName || "",
          displayName: row.displayName || null,
          matchedEmail: row.matchedEmail,
          wins: row.wins,
          losses: row.losses,
          draws: row.draws,
          matchPoints: row.matchPoints,
          gameWinPercent: percentToInt(row.gameWinPercent),
          opponentMatchWinPercent: percentToInt(row.opponentMatchWinPercent),
        })),
      );
    }

    // Guests need placeholder users so matches can FK to users.id
    await ensureGuestPlayersForPairings(db, eventId);

    const regsWithUsers = await db
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId));

    // Build userId map for match import (team id → user, then name)
    const nameToUserId = new Map<string, number>();
    const teamToUserId = new Map<string, number>();
    const regById = new Map(regsWithUsers.map((r) => [r.id, r]));

    for (const row of matched) {
      if (!row.registrationId) continue;
      const reg = regById.get(row.registrationId);
      if (!reg?.userId) continue;
      if (row.teamId) teamToUserId.set(row.teamId, reg.userId);
      nameToUserId.set(normalizeCompanionName(`${reg.firstName} ${reg.lastName}`), reg.userId);
      if (row.displayName) nameToUserId.set(normalizeCompanionName(row.displayName), reg.userId);
      nameToUserId.set(normalizeCompanionName(`${row.firstName} ${row.lastName}`), reg.userId);
    }

    for (const r of regsWithUsers) {
      if (!r.userId) continue;
      nameToUserId.set(normalizeCompanionName(`${r.firstName} ${r.lastName}`), r.userId);
      if (r.companionTeamId) teamToUserId.set(r.companionTeamId, r.userId);
    }

    // Ensure placeholder users for unmatched companion players needed by matches FK
    for (const p of payload.players) {
      const key = normalizeCompanionName(p.displayName);
      if (p.teamId && teamToUserId.has(p.teamId)) continue;
      if (nameToUserId.has(key)) continue;

      const parts = p.displayName.trim().split(/\s+/);
      const firstName = normalizeName(p.firstName ?? parts[0] ?? "Player");
      const lastName = normalizeName(p.lastName ?? (parts.slice(1).join(" ") || "Companion"));

      // Guest regs were materialized above; skip creating a duplicate reg for the same name
      const existingGuest = regsWithUsers.find(
        (r) => r.isGuest && normalizeCompanionName(`${r.firstName} ${r.lastName}`) === key,
      );
      if (existingGuest?.userId) {
        nameToUserId.set(key, existingGuest.userId);
        if (p.teamId) teamToUserId.set(p.teamId, existingGuest.userId);
        continue;
      }

      const usernameBase = `comp_${payload.eventId.slice(0, 6)}_${key.replace(/\s+/g, "_")}`.slice(0, 60);
      let username = usernameBase;
      let n = 0;
      while (true) {
        const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
        if (!exists) break;
        n += 1;
        username = `${usernameBase}_${n}`.slice(0, 64);
      }

      const [placeholder] = await db
        .insert(users)
        .values({
          email: `${username}@companion.import.local`,
          username,
          passwordHash: "!companion-import!",
          firstName,
          lastName,
          emailVerified: false,
        })
        .returning();

      await db.insert(eventRegistrations).values({
        eventId,
        userId: placeholder.id,
        firstName,
        lastName,
        registrationStatus: "confirmed",
        isGuest: false,
        companionTeamId: p.teamId ?? null,
      });

      nameToUserId.set(key, placeholder.id);
      if (p.teamId) teamToUserId.set(p.teamId, placeholder.id);
    }

    // Refresh maps after inserts
    const regs2 = await db
      .select()
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), isNotNull(eventRegistrations.userId)));
    for (const r of regs2) {
      nameToUserId.set(normalizeCompanionName(`${r.firstName} ${r.lastName}`), r.userId!);
      if (r.companionTeamId) teamToUserId.set(r.companionTeamId, r.userId!);
    }

    const phase = await ensureInitialPhase(db, event, payload.players.length || matched.length);
    await activatePhase(db, eventId, phase, 1);

    await db.delete(matches).where(eq(matches.eventId, eventId));

    const matchRows: (typeof matches.$inferInsert)[] = [];
    let maxRound = 0;
    for (const m of payload.matches) {
      const p1 =
        (m.teamId1 && teamToUserId.get(m.teamId1)) ||
        nameToUserId.get(normalizeCompanionName(m.player1Name));
      if (!p1) continue;
      const p2 = m.isBye || !m.player2Name
        ? null
        : (m.teamId2 && teamToUserId.get(m.teamId2)) ||
          nameToUserId.get(normalizeCompanionName(m.player2Name)) ||
          null;

      // Name collisions can map both sides to the same user — skip invalid rows.
      if (p2 != null && p2 === p1) continue;

      let result: "pending" | "p1_win" | "p2_win" | "draw" = "pending";
      if (m.result === "bye" || !p2) result = "p1_win";
      else if (m.result === "p1_win" || m.result === "p2_win" || m.result === "draw") result = m.result;

      maxRound = Math.max(maxRound, m.round);
      matchRows.push({
        eventId,
        phaseId: phase.id,
        round: m.round,
        player1Id: p1,
        player2Id: p2,
        tableNumber: m.tableNumber ?? null,
        result,
        p1Games: asGameCount(
          m.player1Games,
          result === "p1_win" ? 2 : result === "draw" ? 1 : 0,
        ),
        p2Games: asGameCount(
          m.player2Games,
          result === "p2_win" ? 2 : result === "draw" ? 1 : 0,
        ),
      });
    }

    // Single insert — per-row inserts blow the Workers subrequest budget on Neon HTTP.
    if (matchRows.length) {
      await db.insert(matches).values(matchRows);
    }

    const pulledAt = new Date();
    await db
      .update(events)
      .set({
        companionEventId: payload.eventId,
        companionEventCode: code,
        companionLastPulledAt: pulledAt,
        companionPullStatus: "ok",
        ...(body.data.markCompleted ? { status: "completed" as const } : {}),
        currentRound: maxRound || event.currentRound,
        opsMode: "companion_linked",
        updatedAt: pulledAt,
      })
      .where(eq(events.id, eventId));

    const reportRows = await loadReport(eventId);
    const reportStandings = mapRows(reportRows);
    const unmatchedCount = reportStandings.filter((s) => !s.matched).length;

    return json({
      message: "Companion results imported",
      players: payload.players.length,
      matches: matchRows.length,
      companionEventId: payload.eventId,
      matchedCount: reportStandings.length - unmatchedCount,
      unmatchedCount,
      standings: reportStandings,
      registrations: await loadOrganizerRegistrations(eventId),
      companionLastPulledAt: pulledAt,
    });
  } catch (err) {
    const message = dbErrorMessage(err);
    try {
      await db
        .update(events)
        .set({ companionPullStatus: message.slice(0, 500), updatedAt: new Date() })
        .where(eq(events.id, eventId));
    } catch {
      // Don't mask the original pull error if status persistence fails.
    }
    if (err instanceof CompanionApiError) return error(message, 400);
    return error(message, 502);
  }
}
