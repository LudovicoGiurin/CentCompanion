import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { eventPhases, events, type Event, type EventPhase } from "../../db/schema";
import { maxSwissRounds } from "./swiss";
import { singleElimRoundsForCut } from "./bracket";

export async function getPhases(db: ReturnType<typeof getDb>, eventId: number) {
  return db
    .select()
    .from(eventPhases)
    .where(eq(eventPhases.eventId, eventId))
    .orderBy(asc(eventPhases.phaseIndex));
}

export async function getActivePhase(
  db: ReturnType<typeof getDb>,
  event: Event,
): Promise<EventPhase | null> {
  if (event.currentPhaseId) {
    const [phase] = await db
      .select()
      .from(eventPhases)
      .where(eq(eventPhases.id, event.currentPhaseId))
      .limit(1);
    if (phase) return phase;
  }
  const [active] = await db
    .select()
    .from(eventPhases)
    .where(and(eq(eventPhases.eventId, event.id), eq(eventPhases.status, "active")))
    .limit(1);
  return active ?? null;
}

export function resolvedSwissRoundCount(event: Event, playerCount: number): number {
  if (event.swissRounds && event.swissRounds > 0) return event.swissRounds;
  return maxSwissRounds(playerCount);
}

export async function ensureInitialPhase(
  db: ReturnType<typeof getDb>,
  event: Event,
  playerCount: number,
): Promise<EventPhase> {
  const existing = await getPhases(db, event.id);
  if (existing.length) {
    const swiss = existing.find((p) => p.kind === "swiss") ?? existing[0];
    // Refresh Swiss round count while the phase hasn't started — never freeze a
    // stale "1 round" from when only a couple players had registered.
    if (swiss.kind === "swiss" && swiss.status === "pending") {
      const roundCount = resolvedSwissRoundCount(event, playerCount);
      if (swiss.roundCount !== roundCount) {
        const [updated] = await db
          .update(eventPhases)
          .set({ roundCount, updatedAt: new Date() })
          .where(eq(eventPhases.id, swiss.id))
          .returning();
        return updated;
      }
    }
    return swiss;
  }

  const structure = event.tournamentStructure ?? "swiss";
  if (structure === "single_elim") {
    const cut = event.topCutSize && event.topCutSize >= 2 ? event.topCutSize : playerCount;
    const [phase] = await db
      .insert(eventPhases)
      .values({
        eventId: event.id,
        phaseIndex: 0,
        kind: "top_cut",
        status: "pending",
        roundCount: singleElimRoundsForCut(Math.min(cut, playerCount)),
        cutSize: Math.min(cut, playerCount),
        currentRound: 0,
      })
      .returning();
    return phase;
  }

  const [phase] = await db
    .insert(eventPhases)
    .values({
      eventId: event.id,
      phaseIndex: 0,
      kind: "swiss",
      status: "pending",
      roundCount: resolvedSwissRoundCount(event, playerCount),
      currentRound: 0,
    })
    .returning();
  return phase;
}

export async function activatePhase(
  db: ReturnType<typeof getDb>,
  eventId: number,
  phase: EventPhase,
  round = 1,
) {
  await db
    .update(eventPhases)
    .set({ status: "completed", updatedAt: new Date() })
    .where(and(eq(eventPhases.eventId, eventId), eq(eventPhases.status, "active")));

  const [updated] = await db
    .update(eventPhases)
    .set({ status: "active", currentRound: round, updatedAt: new Date() })
    .where(eq(eventPhases.id, phase.id))
    .returning();

  await db
    .update(events)
    .set({ currentPhaseId: phase.id, currentRound: round, updatedAt: new Date() })
    .where(eq(events.id, eventId));

  return updated;
}

export async function completePhase(db: ReturnType<typeof getDb>, phaseId: number) {
  await db
    .update(eventPhases)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(eventPhases.id, phaseId));
}

export async function createTopCutPhase(
  db: ReturnType<typeof getDb>,
  event: Event,
  cutSize: number,
): Promise<EventPhase> {
  const phases = await getPhases(db, event.id);
  const nextIndex = phases.length ? Math.max(...phases.map((p) => p.phaseIndex)) + 1 : 1;
  const [phase] = await db
    .insert(eventPhases)
    .values({
      eventId: event.id,
      phaseIndex: nextIndex,
      kind: "top_cut",
      status: "pending",
      roundCount: singleElimRoundsForCut(cutSize),
      cutSize,
      currentRound: 0,
    })
    .returning();
  return phase;
}
