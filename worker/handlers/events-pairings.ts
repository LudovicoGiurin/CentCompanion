import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import {
  eventPhases,
  eventRegistrations,
  events,
  matches,
  pairingMeta,
  users,
  type Event,
} from "../../db/schema";
import { error, getAuthUser, json, type RouteParams } from "../_shared/auth";
import {
  computeStandings,
  generatePairingsForRound,
  normalizeManualPairings,
  validateManualPairings,
  type MatchRecord,
} from "../_shared/swiss";
import {
  advanceWinners,
  pairWinnersForNextRound,
  seedSingleElimBracket,
} from "../_shared/bracket";
import {
  activatePhase,
  completePhase,
  createTopCutPhase,
  ensureInitialPhase,
  getActivePhase,
  getPhases,
  resolvedSwissRoundCount,
} from "../_shared/phases";
import { resolveEventPermissions, publicEventPermissions } from "../_shared/event-permissions";
import { formatPlayerName, ensureGuestPlayersForPairings } from "../_shared/registrations";
import { serializeRoundTimer } from "../_shared/round-timer";
import { gamesFromResult, parseBo3Score } from "../_shared/match-score";
import { checkRateLimit } from "../_shared/rate-limit";

const updateMatchSchema = z
  .object({
    matchId: z.number(),
    result: z.enum(["pending", "p1_win", "p2_win", "draw"]).optional(),
    p1Games: z.number().int().min(0).max(2).optional(),
    p2Games: z.number().int().min(0).max(2).optional(),
    expectedUpdatedAt: z.string().optional(),
  })
  .refine(
    (data) =>
      data.result !== undefined ||
      (data.p1Games !== undefined && data.p2Games !== undefined),
    { message: "Provide match score or result" },
  );

const saveManualPairingsSchema = z.object({
  round: z.number().int().positive(),
  pairings: z
    .array(
      z.object({
        player1Id: z.number(),
        player2Id: z.number().nullable(),
        tableNumber: z.number().int().positive().optional(),
      }),
    )
    .min(1),
});

const dropPlayerSchema = z
  .object({
    registrationId: z.number().int().positive().optional(),
    userId: z.number().int().positive().optional(),
  })
  .refine((d) => d.registrationId != null || d.userId != null, {
    message: "registrationId or userId is required",
  });

const roundTimerSchema = z.object({
  round: z.number().int().positive().optional(),
  remainingSec: z.number().int().min(0).max(86400),
  running: z.boolean(),
});

async function ensurePairingMeta(
  db: ReturnType<typeof getDb>,
  eventId: number,
  round: number,
  phaseId: number | null,
) {
  const [existing] = await db
    .select()
    .from(pairingMeta)
    .where(
      and(
        eq(pairingMeta.eventId, eventId),
        eq(pairingMeta.round, round),
        phaseId != null ? eq(pairingMeta.phaseId, phaseId) : sql`${pairingMeta.phaseId} is null`,
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(pairingMeta)
    .values({ eventId, round, phaseId })
    .returning();
  return created;
}

async function applyRoundTimer(
  db: ReturnType<typeof getDb>,
  eventId: number,
  round: number,
  phaseId: number | null,
  remainingSec: number,
  running: boolean,
) {
  await ensurePairingMeta(db, eventId, round, phaseId);
  const now = new Date();
  await db
    .update(pairingMeta)
    .set({
      roundTimerSec: remainingSec,
      roundTimerRunning: running && remainingSec > 0,
      roundTimerAt: running && remainingSec > 0 ? now : null,
    })
    .where(
      and(
        eq(pairingMeta.eventId, eventId),
        eq(pairingMeta.round, round),
        phaseId != null ? eq(pairingMeta.phaseId, phaseId) : sql`${pairingMeta.phaseId} is null`,
      ),
    );
}

async function getActivePlayerIds(db: ReturnType<typeof getDb>, eventId: number) {
  const regs = await db
    .select({ userId: eventRegistrations.userId })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.registrationStatus, "confirmed"),
        isNotNull(eventRegistrations.userId),
      ),
    );
  return regs.map((r) => r.userId!);
}

async function getStandingsPlayerIds(db: ReturnType<typeof getDb>, eventId: number) {
  const regs = await db
    .select({ userId: eventRegistrations.userId })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        inArray(eventRegistrations.registrationStatus, ["confirmed", "dropped"]),
        isNotNull(eventRegistrations.userId),
      ),
    );
  return regs.map((r) => r.userId!);
}

async function getAllEventMatches(db: ReturnType<typeof getDb>, eventId: number, phaseId?: number | null) {
  if (phaseId != null) {
    return db
      .select({
        round: matches.round,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        result: matches.result,
        phaseId: matches.phaseId,
        updatedAt: matches.updatedAt,
      })
      .from(matches)
      .where(and(eq(matches.eventId, eventId), eq(matches.phaseId, phaseId)));
  }
  return db
    .select({
      round: matches.round,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      result: matches.result,
      phaseId: matches.phaseId,
      updatedAt: matches.updatedAt,
    })
    .from(matches)
    .where(eq(matches.eventId, eventId));
}

async function savePairings(
  db: ReturnType<typeof getDb>,
  eventId: number,
  round: number,
  phaseId: number | null,
  pairings: { player1Id: number; player2Id: number | null; tableNumber: number }[],
  isReroll: boolean,
) {
  const roundFilter =
    phaseId != null
      ? and(eq(matches.eventId, eventId), eq(matches.round, round), eq(matches.phaseId, phaseId))
      : and(eq(matches.eventId, eventId), eq(matches.round, round));

  await db.delete(matches).where(roundFilter);

  if (pairings.length) {
    await db.insert(matches).values(
      pairings.map((p) => ({
        eventId,
        phaseId,
        round,
        player1Id: p.player1Id,
        player2Id: p.player2Id,
        tableNumber: p.tableNumber,
        // Swiss/elim BYEs are automatic wins — no result entry needed
        ...(p.player2Id == null
          ? { result: "p1_win" as const, p1Games: 2, p2Games: 0 }
          : {}),
      })),
    );
  }

  const [existingMeta] = await db
    .select()
    .from(pairingMeta)
    .where(
      and(
        eq(pairingMeta.eventId, eventId),
        eq(pairingMeta.round, round),
        phaseId != null ? eq(pairingMeta.phaseId, phaseId) : sql`${pairingMeta.phaseId} is null`,
      ),
    )
    .limit(1);

  if (existingMeta) {
    await db
      .update(pairingMeta)
      .set({ rerollCount: existingMeta.rerollCount + 1, generatedAt: new Date() })
      .where(eq(pairingMeta.id, existingMeta.id));
  } else {
    await db.insert(pairingMeta).values({
      eventId,
      phaseId,
      round,
      rerollCount: isReroll ? 1 : 0,
    });
  }
}

async function enrichMatches(
  db: ReturnType<typeof getDb>,
  eventId: number,
  round: number,
  phaseId: number | null,
) {
  const conditions = [eq(matches.eventId, eventId), eq(matches.round, round)];
  if (phaseId != null) conditions.push(eq(matches.phaseId, phaseId));

  const eventMatches = await db
    .select({
      id: matches.id,
      round: matches.round,
      phaseId: matches.phaseId,
      result: matches.result,
      p1Games: matches.p1Games,
      p2Games: matches.p2Games,
      tableNumber: matches.tableNumber,
      player1: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      reportedBy: matches.reportedBy,
      updatedAt: matches.updatedAt,
    })
    .from(matches)
    .leftJoin(users, eq(matches.player1Id, users.id))
    .where(and(...conditions))
    .orderBy(asc(matches.tableNumber));

  return Promise.all(
    eventMatches.map(async (m) => {
      let player2Name = "BYE";
      if (m.player2Id) {
        const [p2] = await db
          .select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
          .from(users)
          .where(eq(users.id, m.player2Id))
          .limit(1);
        player2Name = formatPlayerName(p2?.firstName, p2?.lastName, p2?.username ?? "Unknown");
      }
      const [p1] = await db
        .select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
        .from(users)
        .where(eq(users.id, m.player1Id))
        .limit(1);

      let reportedByName: string | null = null;
      if (m.reportedBy) {
        const [reporter] = await db
          .select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
          .from(users)
          .where(eq(users.id, m.reportedBy))
          .limit(1);
        reportedByName = reporter
          ? formatPlayerName(reporter.firstName, reporter.lastName, reporter.username)
          : null;
      }

      return {
        ...m,
        player1: formatPlayerName(p1?.firstName, p1?.lastName, p1?.username ?? "Unknown"),
        player2: player2Name,
        reportedByName,
        updatedAt: m.updatedAt?.toISOString?.() ?? m.updatedAt,
      };
    }),
  );
}

async function buildStandingsResponse(
  db: ReturnType<typeof getDb>,
  eventId: number,
  playerIds: number[],
  allMatches: MatchRecord[],
) {
  const standings = computeStandings(playerIds, allMatches);
  const enriched = await Promise.all(
    standings.map(async (s, index) => {
      const [player] = await db
        .select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
        .from(users)
        .where(eq(users.id, s.userId))
        .limit(1);
      return {
        rank: index + 1,
        userId: s.userId,
        displayName: formatPlayerName(player?.firstName, player?.lastName, player?.username ?? "Unknown"),
        points: s.points,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        byes: s.byes,
        omw: Math.round(s.opponentMatchWinPct * 10) / 10,
      };
    }),
  );
  return enriched;
}

function assertNativeOps(event: Event) {
  if (event.opsMode === "companion_linked") {
    return error(
      "This event is Companion-linked. Use Pull Companion results instead of native pairings.",
      400,
    );
  }
  return null;
}

export async function handleEventsPairings(req: Request, params: RouteParams): Promise<Response> {
  const db = getDb();
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return error("Event not found", 404);

  const authUser = await getAuthUser(req);
  const perms = authUser ? await resolveEventPermissions(authUser, event) : publicEventPermissions();
  const isOrganizer = perms.canManage || perms.canEditPairings;

  if (req.method === "GET") {
    const activePhase = await getActivePhase(db, event);
    const phaseId = activePhase?.id ?? event.currentPhaseId ?? null;
    const round = Number(
      new URL(req.url).searchParams.get("round") ?? activePhase?.currentRound ?? event.currentRound ?? 1,
    );

    // Auto-resolve BYE matches so they never block progress / end-round
    await db
      .update(matches)
      .set({ result: "p1_win", p1Games: 2, p2Games: 0, updatedAt: new Date() })
      .where(
        and(
          eq(matches.eventId, eventId),
          eq(matches.round, round),
          eq(matches.result, "pending"),
          sql`${matches.player2Id} is null`,
          phaseId != null ? eq(matches.phaseId, phaseId) : sql`true`,
        ),
      );

    const enriched = await enrichMatches(db, eventId, round, phaseId);

    const [meta] = await db
      .select()
      .from(pairingMeta)
      .where(
        and(
          eq(pairingMeta.eventId, eventId),
          eq(pairingMeta.round, round),
          phaseId != null ? eq(pairingMeta.phaseId, phaseId) : sql`true`,
        ),
      )
      .limit(1);

    const playerIds = await getActivePlayerIds(db, eventId);
    const standingsPlayerIds = await getStandingsPlayerIds(db, eventId);
    const swissMatches = await getAllEventMatches(db, eventId);
    // Standings use all swiss-phase matches (or all if single stream)
    const phases = await getPhases(db, eventId);
    const swissPhase = phases.find((p) => p.kind === "swiss");
    const standingsSource =
      swissPhase != null
        ? swissMatches.filter((m) => m.phaseId === swissPhase.id || m.phaseId == null)
        : swissMatches;

    const matchRecords: MatchRecord[] = standingsSource.map((m) => ({
      round: m.round,
      player1Id: m.player1Id,
      player2Id: m.player2Id,
      result: m.result,
    }));

    const phaseMatches = phaseId != null ? swissMatches.filter((m) => m.phaseId === phaseId) : swissMatches;
    const allRounds = [...new Set(phaseMatches.map((m) => m.round))].sort((a, b) => a - b);
    const standings = await buildStandingsResponse(db, eventId, standingsPlayerIds, matchRecords);

    const totalRounds =
      activePhase?.kind === "top_cut"
        ? activePhase.roundCount ?? 1
        : resolvedSwissRoundCount(event, playerIds.length);

    const payload = {
      matches: enriched,
      meta,
      timer: serializeRoundTimer(meta ?? undefined),
      event,
      standings,
      totalRounds,
      availableRounds: allRounds.length ? allRounds : event.status === "ongoing" ? [round] : [],
      playerCount: playerIds.length,
      isOrganizer,
      permissions: perms,
      phases,
      activePhase,
      phaseKind: activePhase?.kind ?? "swiss",
    };

    const etag = `"${eventId}-${round}-${phaseId ?? 0}-${enriched.length}-${meta?.rerollCount ?? 0}-${standings[0]?.points ?? 0}"`;
    const ifNoneMatch = req.headers.get("If-None-Match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
        "Cache-Control": authUser ? "private, no-cache" : "public, max-age=5",
      },
    });
  }

  if (!authUser) return error("Unauthorized", 401);

  const rate = checkRateLimit(`pairings:${authUser.id}:${eventId}`, 60, 60_000);
  if (!rate.ok) return error("Too many requests — slow down", 429);

  if (req.method === "POST") {
    const action = new URL(req.url).searchParams.get("action");

    if (action === "drop") {
      if (!perms.canDrop) return error("Organizer access required", 403);
    } else if (action === "timer" || action === "save-pairings" || action === "generate" || action === "reroll") {
      if (!perms.canEditPairings) return error("Organizer access required", 403);
    } else if (!perms.canManage && action !== "complete") {
      if (!perms.canEditPairings) return error("Organizer access required", 403);
    } else if (action === "complete" && !perms.canManage) {
      return error("Organizer access required", 403);
    }

    if (action !== "complete" && action !== "drop") {
      const blocked = assertNativeOps(event);
      if (blocked) return blocked;
    }

    if (
      action === "start" ||
      action === "generate" ||
      action === "reroll" ||
      action === "end-round" ||
      action === "save-pairings" ||
      action === "resume-swiss"
    ) {
      await ensureGuestPlayersForPairings(db, eventId);
    }

    const playerIds = await getActivePlayerIds(db, eventId);

    if (action === "start") {
      if (playerIds.length < 1) {
        return error("At least one registered player is required to start the tournament", 400);
      }

      const phase = await ensureInitialPhase(db, event, playerIds.length);

      // Always sync Swiss round count from current field + player count at start
      let activeStartPhase = phase;
      if (phase.kind === "swiss") {
        const roundCount = resolvedSwissRoundCount(event, playerIds.length);
        if (phase.roundCount !== roundCount) {
          const [updated] = await db
            .update(eventPhases)
            .set({ roundCount, updatedAt: new Date() })
            .where(eq(eventPhases.id, phase.id))
            .returning();
          activeStartPhase = updated;
        }
      }

      await activatePhase(db, eventId, activeStartPhase, 1);

      let pairings;
      if (activeStartPhase.kind === "top_cut" || event.tournamentStructure === "single_elim") {
        const cut = activeStartPhase.cutSize ?? playerIds.length;
        const seeded = playerIds.slice(0, cut);
        const ordered =
          event.tournamentStructure === "single_elim"
            ? seeded
            : seeded;
        pairings = seedSingleElimBracket(ordered);
      } else {
        pairings = generatePairingsForRound(playerIds, 1, []);
      }

      await db.update(events).set({ status: "ongoing", currentRound: 1 }).where(eq(events.id, eventId));
      await savePairings(db, eventId, 1, activeStartPhase.id, pairings, false);

      // Auto-complete BYE matches in elim
      if (activeStartPhase.kind === "top_cut") {
        await db
          .update(matches)
          .set({ result: "p1_win", p1Games: 2, p2Games: 0, updatedAt: new Date() })
          .where(
            and(
              eq(matches.eventId, eventId),
              eq(matches.phaseId, activeStartPhase.id),
              eq(matches.round, 1),
              sql`${matches.player2Id} is null`,
            ),
          );
      }

      return json({
        message: "Event started and round 1 pairings generated",
        round: 1,
        players: playerIds.length,
        tables: pairings.length,
        phaseId: activeStartPhase.id,
        totalRounds: activeStartPhase.roundCount,
      });
    }

    if (action === "generate" || action === "reroll") {
      if (playerIds.length < 1) {
        return error("At least one registered player is required", 400);
      }
      const activePhase = await getActivePhase(db, event);
      if (!activePhase) return error("No active phase", 400);
      if (activePhase.kind === "top_cut" && action === "reroll") {
        return error("Cannot reroll elimination brackets", 400);
      }

      const round = Number(new URL(req.url).searchParams.get("round") ?? activePhase.currentRound ?? 1);
      const allMatches = await getAllEventMatches(db, eventId, activePhase.id);
      const matchRecords: MatchRecord[] = allMatches.map((m) => ({
        round: m.round,
        player1Id: m.player1Id,
        player2Id: m.player2Id,
        result: m.result,
      }));

      const pairings =
        activePhase.kind === "top_cut"
          ? seedSingleElimBracket(playerIds.slice(0, activePhase.cutSize ?? playerIds.length))
          : generatePairingsForRound(playerIds, round, matchRecords);

      await savePairings(db, eventId, round, activePhase.id, pairings, action === "reroll");

      return json({
        message: "Pairings generated",
        round,
        players: playerIds.length,
        tables: pairings.length,
      });
    }

    if (action === "end-round") {
      const activePhase = await getActivePhase(db, event);
      if (!activePhase) return error("No active phase", 400);

      const round = activePhase.currentRound || event.currentRound || 1;
      const roundMatches = await db
        .select()
        .from(matches)
        .where(
          and(eq(matches.eventId, eventId), eq(matches.round, round), eq(matches.phaseId, activePhase.id)),
        );

      if (!roundMatches.length) {
        return error("No pairings for the current round", 400);
      }

      // Heal any lingering BYE rows left pending (older rounds / imports)
      await db
        .update(matches)
        .set({ result: "p1_win", p1Games: 2, p2Games: 0, updatedAt: new Date() })
        .where(
          and(
            eq(matches.eventId, eventId),
            eq(matches.round, round),
            eq(matches.phaseId, activePhase.id),
            eq(matches.result, "pending"),
            sql`${matches.player2Id} is null`,
          ),
        );

      const pending = roundMatches.filter((m) => m.result === "pending" && m.player2Id != null);
      if (pending.length) {
        return error(`${pending.length} match(es) still pending results`, 400);
      }

      if (activePhase.kind === "top_cut") {
        const totalRounds = activePhase.roundCount ?? 1;
        const winners = advanceWinners(roundMatches);
        const nextRound = round + 1;

        if (nextRound > totalRounds || winners.length <= 1) {
          await completePhase(db, activePhase.id);
          await db
            .update(events)
            .set({ status: "completed", currentRound: round, updatedAt: new Date() })
            .where(eq(events.id, eventId));
          return json({ message: "Tournament completed", completed: true, round });
        }

        const pairings = pairWinnersForNextRound(winners);
        await db
          .update(eventPhases)
          .set({ currentRound: nextRound, updatedAt: new Date() })
          .where(eq(eventPhases.id, activePhase.id));
        await db
          .update(events)
          .set({ currentRound: nextRound, updatedAt: new Date() })
          .where(eq(events.id, eventId));
        await savePairings(db, eventId, nextRound, activePhase.id, pairings, false);

        await db
          .update(matches)
          .set({ result: "p1_win", p1Games: 2, p2Games: 0, updatedAt: new Date() })
          .where(
            and(
              eq(matches.eventId, eventId),
              eq(matches.phaseId, activePhase.id),
              eq(matches.round, nextRound),
              sql`${matches.player2Id} is null`,
            ),
          );

        return json({
          message: `Round ${round} ended. Round ${nextRound} pairings generated.`,
          round: nextRound,
          tables: pairings.length,
        });
      }

      // Swiss phase — always resolve from event settings + current players.
      // Never trust a stale phase.roundCount (e.g. frozen at 1 when only 2 players had registered).
      const totalRounds = resolvedSwissRoundCount(event, playerIds.length);
      if (activePhase.roundCount !== totalRounds) {
        await db
          .update(eventPhases)
          .set({ roundCount: totalRounds, updatedAt: new Date() })
          .where(eq(eventPhases.id, activePhase.id));
      }
      const nextRound = round + 1;

      if (nextRound > totalRounds) {
        if (event.tournamentStructure === "swiss_top_cut") {
          const cutSize = event.topCutSize && [2, 4, 8].includes(event.topCutSize) ? event.topCutSize : 8;
          const standingsPlayerIds = await getStandingsPlayerIds(db, eventId);
          const swissAll = await getAllEventMatches(db, eventId, activePhase.id);
          const standings = computeStandings(
            standingsPlayerIds,
            swissAll.map((m) => ({
              round: m.round,
              player1Id: m.player1Id,
              player2Id: m.player2Id,
              result: m.result,
            })),
          );
          const cutPlayers = standings.slice(0, cutSize).map((s) => s.userId);
          if (cutPlayers.length < 2) {
            await completePhase(db, activePhase.id);
            await db
              .update(events)
              .set({ status: "completed", currentRound: round })
              .where(eq(events.id, eventId));
            return json({ message: "Tournament completed (not enough players for top cut)", completed: true, round });
          }

          await completePhase(db, activePhase.id);
          const topPhase = await createTopCutPhase(db, event, cutPlayers.length);
          await activatePhase(db, eventId, topPhase, 1);
          const pairings = seedSingleElimBracket(cutPlayers);
          await savePairings(db, eventId, 1, topPhase.id, pairings, false);
          await db
            .update(matches)
            .set({ result: "p1_win", p1Games: 2, p2Games: 0, updatedAt: new Date() })
            .where(
              and(
                eq(matches.eventId, eventId),
                eq(matches.phaseId, topPhase.id),
                eq(matches.round, 1),
                sql`${matches.player2Id} is null`,
              ),
            );

          return json({
            message: `Swiss complete. Top ${cutPlayers.length} cut started.`,
            round: 1,
            topCut: true,
            tables: pairings.length,
            phaseId: topPhase.id,
          });
        }

        await completePhase(db, activePhase.id);
        await db
          .update(events)
          .set({ status: "completed", currentRound: round })
          .where(eq(events.id, eventId));
        return json({ message: "Tournament completed", completed: true, round });
      }

      const allMatches = await getAllEventMatches(db, eventId, activePhase.id);
      const matchRecords: MatchRecord[] = allMatches.map((m) => ({
        round: m.round,
        player1Id: m.player1Id,
        player2Id: m.player2Id,
        result: m.result,
      }));

      const pairings = generatePairingsForRound(playerIds, nextRound, matchRecords);
      await db
        .update(eventPhases)
        .set({ currentRound: nextRound, updatedAt: new Date() })
        .where(eq(eventPhases.id, activePhase.id));
      await db
        .update(events)
        .set({ currentRound: nextRound })
        .where(eq(events.id, eventId));
      await savePairings(db, eventId, nextRound, activePhase.id, pairings, false);

      return json({
        message: `Round ${round} ended. Round ${nextRound} pairings generated.`,
        round: nextRound,
        tables: pairings.length,
      });
    }

    if (action === "resume-swiss") {
      const activePhase = await getActivePhase(db, event);
      if (!activePhase || activePhase.kind !== "top_cut") {
        return error("Resume Swiss is only available during an early top cut", 400);
      }
      if (event.tournamentStructure !== "swiss_top_cut" && event.tournamentStructure !== "swiss") {
        return error("This event is not a Swiss tournament", 400);
      }

      const phases = await getPhases(db, eventId);
      const swissPhase = phases.find((p) => p.kind === "swiss");
      if (!swissPhase) return error("No Swiss phase found to resume", 400);

      const swissMatches = await getAllEventMatches(db, eventId, swissPhase.id);
      const lastSwissRound = swissMatches.length
        ? Math.max(...swissMatches.map((m) => m.round))
        : 0;
      const nextRound = Math.max(1, lastSwissRound + 1);
      const totalRounds = Math.max(
        resolvedSwissRoundCount(event, playerIds.length),
        nextRound,
      );

      // Remove premature top-cut matches / meta / phase
      await db.delete(matches).where(eq(matches.phaseId, activePhase.id));
      await db.delete(pairingMeta).where(eq(pairingMeta.phaseId, activePhase.id));
      await db.delete(eventPhases).where(eq(eventPhases.id, activePhase.id));

      await db
        .update(eventPhases)
        .set({
          status: "active",
          currentRound: nextRound,
          roundCount: totalRounds,
          updatedAt: new Date(),
        })
        .where(eq(eventPhases.id, swissPhase.id));

      await db
        .update(events)
        .set({
          status: "ongoing",
          currentPhaseId: swissPhase.id,
          currentRound: nextRound,
          updatedAt: new Date(),
        })
        .where(eq(events.id, eventId));

      const matchRecords: MatchRecord[] = swissMatches.map((m) => ({
        round: m.round,
        player1Id: m.player1Id,
        player2Id: m.player2Id,
        result: m.result,
      }));
      const pairings = generatePairingsForRound(playerIds, nextRound, matchRecords);
      await savePairings(db, eventId, nextRound, swissPhase.id, pairings, false);

      return json({
        message: `Resumed Swiss at round ${nextRound} of ${totalRounds}`,
        round: nextRound,
        tables: pairings.length,
        totalRounds,
        resumedSwiss: true,
      });
    }

    if (action === "complete") {
      const activePhase = await getActivePhase(db, event);
      if (activePhase) await completePhase(db, activePhase.id);
      await db
        .update(events)
        .set({ status: "completed" })
        .where(eq(events.id, eventId));
      return json({ message: "Tournament marked as completed" });
    }

    if (action === "drop") {
      const body = dropPlayerSchema.safeParse(await req.json());
      if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

      const [reg] = body.data.registrationId
        ? await db
            .select()
            .from(eventRegistrations)
            .where(
              and(
                eq(eventRegistrations.eventId, eventId),
                eq(eventRegistrations.id, body.data.registrationId),
                eq(eventRegistrations.registrationStatus, "confirmed"),
              ),
            )
            .limit(1)
        : await db
            .select()
            .from(eventRegistrations)
            .where(
              and(
                eq(eventRegistrations.eventId, eventId),
                eq(eventRegistrations.userId, body.data.userId!),
                eq(eventRegistrations.registrationStatus, "confirmed"),
              ),
            )
            .limit(1);
      if (!reg) return error("Player is not an active registration", 404);

      const userId = reg.userId;

      if (event.status === "ongoing" && userId != null) {
        const activePhase = await getActivePhase(db, event);
        const currentRound = activePhase?.currentRound ?? event.currentRound ?? 1;
        const pendingMatches = await db
          .select()
          .from(matches)
          .where(
            and(
              eq(matches.eventId, eventId),
              eq(matches.round, currentRound),
              eq(matches.result, "pending"),
              or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)),
              activePhase ? eq(matches.phaseId, activePhase.id) : sql`true`,
            ),
          );

        for (const m of pendingMatches) {
          if (!m.player2Id) {
            await db.delete(matches).where(eq(matches.id, m.id));
          } else if (m.player1Id === userId) {
            await db
              .update(matches)
              .set({
                result: "p2_win",
                p1Games: 0,
                p2Games: 2,
                reportedBy: null,
                reportedAt: null,
                updatedAt: new Date(),
              })
              .where(eq(matches.id, m.id));
          } else {
            await db
              .update(matches)
              .set({
                result: "p1_win",
                p1Games: 2,
                p2Games: 0,
                reportedBy: null,
                reportedAt: null,
                updatedAt: new Date(),
              })
              .where(eq(matches.id, m.id));
          }
        }
      }

      await db
        .update(eventRegistrations)
        .set({ registrationStatus: "dropped", updatedAt: new Date() })
        .where(eq(eventRegistrations.id, reg.id));

      return json({ message: "Player dropped from the tournament" });
    }

    if (action === "save-pairings") {
      const body = saveManualPairingsSchema.safeParse(await req.json());
      if (!body.success) return error("Invalid input");

      const activePhase = await getActivePhase(db, event);
      const round = body.data.round;
      const currentRound = activePhase?.currentRound ?? event.currentRound ?? 1;
      if (event.status === "ongoing" && round !== currentRound) {
        return error("Manual pairings can only be saved for the current round", 400);
      }

      const activeIds = await getActivePlayerIds(db, eventId);
      const allMatches = await getAllEventMatches(db, eventId, activePhase?.id);
      const priorMatches: MatchRecord[] = allMatches
        .filter((m) => m.round < round)
        .map((m) => ({
          round: m.round,
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          result: m.result,
        }));

      const normalized = normalizeManualPairings(
        body.data.pairings.map((p, index) => ({
          player1Id: p.player1Id,
          player2Id: p.player2Id,
          tableNumber: p.tableNumber ?? index + 1,
        })),
      );

      const validation = validateManualPairings(activeIds, normalized, priorMatches);
      if (!validation.valid) return error(validation.error ?? "Invalid pairings", 400);

      await savePairings(db, eventId, round, activePhase?.id ?? null, normalized, true);

      return json({
        message: "Pairings saved",
        warnings: validation.warnings,
        round,
        tables: normalized.length,
      });
    }

    if (action === "timer") {
      const body = roundTimerSchema.safeParse(await req.json());
      if (!body.success) return error("Invalid input");

      const activePhase = await getActivePhase(db, event);
      const round = body.data.round ?? activePhase?.currentRound ?? event.currentRound ?? 1;
      if (event.status === "ongoing" && round !== (activePhase?.currentRound ?? event.currentRound ?? 1)) {
        return error("Timer can only be set for the current round", 400);
      }

      await applyRoundTimer(
        db,
        eventId,
        round,
        activePhase?.id ?? null,
        body.data.remainingSec,
        body.data.running,
      );

      const [meta] = await db
        .select()
        .from(pairingMeta)
        .where(
          and(
            eq(pairingMeta.eventId, eventId),
            eq(pairingMeta.round, round),
            activePhase ? eq(pairingMeta.phaseId, activePhase.id) : sql`true`,
          ),
        )
        .limit(1);

      return json({
        message: "Round timer updated",
        timer: serializeRoundTimer(meta ?? undefined),
        round,
      });
    }

    return error("Unknown action", 400);
  }

  if (req.method === "PATCH") {
    const body = updateMatchSchema.safeParse(await req.json());
    if (!body.success) return error("Invalid input");

    const [existing] = await db
      .select()
      .from(matches)
      .where(and(eq(matches.id, body.data.matchId), eq(matches.eventId, eventId)))
      .limit(1);
    if (!existing) return error("Match not found", 404);

    const isParticipant = existing.player1Id === authUser.id || existing.player2Id === authUser.id;
    const canScore = perms.canScore || isParticipant;

    if (!canScore) return error("Forbidden", 403);

    if (!perms.canScore) {
      if (event.status !== "ongoing") return error("Event is not in progress", 400);
      const activePhase = await getActivePhase(db, event);
      if (existing.round !== (activePhase?.currentRound ?? event.currentRound ?? 1)) {
        return error("You can only report results for the current round", 400);
      }
      if (!existing.player2Id) return error("BYE matches are reported by the organizer", 400);
      if (body.data.p1Games === undefined || body.data.p2Games === undefined) {
        return error("Enter the match score (best of 3)", 400);
      }
    }

    if (body.data.expectedUpdatedAt) {
      const expected = new Date(body.data.expectedUpdatedAt).getTime();
      const actual = existing.updatedAt.getTime();
      if (Math.abs(expected - actual) > 1000) {
        return error("Match was updated by someone else — refresh and try again", 409);
      }
    }

    let result: "pending" | "p1_win" | "p2_win" | "draw";
    let p1Games: number | null;
    let p2Games: number | null;

    if (body.data.p1Games !== undefined && body.data.p2Games !== undefined) {
      const parsed = parseBo3Score(body.data.p1Games, body.data.p2Games);
      if (!parsed.ok) return error(parsed.message, 400);
      result = parsed.result;
      p1Games = parsed.p1Games;
      p2Games = parsed.p2Games;
    } else if (body.data.result === "pending") {
      result = "pending";
      p1Games = null;
      p2Games = null;
    } else if (body.data.result) {
      const games = gamesFromResult(body.data.result);
      result = body.data.result;
      p1Games = games.p1Games;
      p2Games = games.p2Games;
    } else {
      return error("Provide match score or result", 400);
    }

    // Top cut: no draws
    const activePhase = await getActivePhase(db, event);
    if (activePhase?.kind === "top_cut" && result === "draw") {
      return error("Draws are not allowed in elimination rounds", 400);
    }

    const [match] = await db
      .update(matches)
      .set({
        result,
        p1Games,
        p2Games,
        reportedBy: perms.canScore ? null : authUser.id,
        reportedAt: perms.canScore ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(matches.id, body.data.matchId), eq(matches.eventId, eventId)))
      .returning();

    if (!match) return error("Match not found", 404);
    return json({ match });
  }

  return error("Method not allowed", 405);
}
