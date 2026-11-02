import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "../../db/index";
import { eventRegistrations, events, matches, pairingMeta, users } from "../../db/schema";
import { error, json, type RouteParams } from "../_shared/auth";
import { computeStandings, maxSwissRounds, type MatchRecord } from "../_shared/swiss";
import { formatPlayerName } from "../_shared/registrations";
import { serializeRoundTimer } from "../_shared/round-timer";

async function enrichDisplayMatches(db: ReturnType<typeof getDb>, eventId: number, round: number) {
  const rows = await db
    .select({
      id: matches.id,
      tableNumber: matches.tableNumber,
      result: matches.result,
      p1Games: matches.p1Games,
      p2Games: matches.p2Games,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
    })
    .from(matches)
    .where(and(eq(matches.eventId, eventId), eq(matches.round, round)))
    .orderBy(asc(matches.tableNumber));

  const playerIds = [
    ...new Set(rows.flatMap((m) => [m.player1Id, m.player2Id].filter((id): id is number => id != null))),
  ];
  const nameMap = new Map<number, string>();
  if (playerIds.length) {
    const players = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
      .from(users)
      .where(inArray(users.id, playerIds));
    for (const p of players) {
      nameMap.set(p.id, formatPlayerName(p.firstName, p.lastName, p.username));
    }
  }

  return rows.map((m) => ({
    id: m.id,
    tableNumber: m.tableNumber,
    result: m.result,
    p1Games: m.p1Games,
    p2Games: m.p2Games,
    player1: nameMap.get(m.player1Id) ?? "Unknown",
    player2: m.player2Id ? (nameMap.get(m.player2Id) ?? "Unknown") : "BYE",
  }));
}

export async function handleEventsDisplay(req: Request, params: RouteParams): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);

  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const db = getDb();
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      storeName: events.storeName,
      status: events.status,
      currentRound: events.currentRound,
      format: events.format,
      approvalStatus: events.approvalStatus,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event || event.approvalStatus !== "approved") return error("Event not found", 404);
  if (event.status !== "ongoing" && event.status !== "completed") {
    return error("Display is available once the tournament has started", 400);
  }

  const round = Number(new URL(req.url).searchParams.get("round") ?? event.currentRound ?? 1);
  const displayMatches = await enrichDisplayMatches(db, eventId, round);

  const [meta] = await db
    .select()
    .from(pairingMeta)
    .where(and(eq(pairingMeta.eventId, eventId), eq(pairingMeta.round, round)))
    .limit(1);

  const allMatchRows = await db
    .select({
      round: matches.round,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      result: matches.result,
    })
    .from(matches)
    .where(eq(matches.eventId, eventId));

  const standingsPlayerIds = (
    await db
      .select({ userId: eventRegistrations.userId })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          inArray(eventRegistrations.registrationStatus, ["confirmed", "dropped"]),
          isNotNull(eventRegistrations.userId),
        ),
      )
  ).map((r) => r.userId!);

  const matchRecords: MatchRecord[] = allMatchRows.map((m) => ({
    round: m.round,
    player1Id: m.player1Id,
    player2Id: m.player2Id,
    result: m.result,
  }));

  const standingsRaw = computeStandings(standingsPlayerIds, matchRecords);
  const standings = await Promise.all(
    standingsRaw.slice(0, 12).map(async (s, index) => {
      const [player] = await db
        .select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
        .from(users)
        .where(eq(users.id, s.userId))
        .limit(1);
      return {
        rank: index + 1,
        displayName: formatPlayerName(player?.firstName, player?.lastName, player?.username ?? "Unknown"),
        points: s.points,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
      };
    }),
  );

  const allRounds = [...new Set(allMatchRows.map((m) => m.round))].sort((a, b) => a - b);
  const activeCount = (
    await db
      .select({ userId: eventRegistrations.userId })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.registrationStatus, "confirmed"),
          isNotNull(eventRegistrations.userId),
        ),
      )
  ).length;

  return json({
    event,
    round,
    matches: displayMatches,
    standings,
    timer: serializeRoundTimer(meta ?? undefined),
    totalRounds: maxSwissRounds(activeCount),
    availableRounds: allRounds.length ? allRounds : [round],
    updatedAt: new Date().toISOString(),
  });
}
