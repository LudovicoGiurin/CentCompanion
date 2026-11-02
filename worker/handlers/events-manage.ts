import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { eventPhases, eventRegistrations, events } from "../../db/schema";
import { error, getAuthUser, json, type RouteParams } from "../_shared/auth";
import { resolveEventPermissions } from "../_shared/event-permissions";
import { getActivePhase, getPhases, resolvedSwissRoundCount } from "../_shared/phases";

const updateEventSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  storeName: z.string().min(2).optional(),
  location: z.string().optional(),
  city: z.string().max(128).optional(),
  startsAt: z.string().optional(),
  registrationDeadline: z.string().nullable().optional(),
  maxPlayers: z.number().int().min(4).max(256).optional(),
  format: z.string().optional(),
  allowGuestRegistration: z.boolean().optional(),
  tournamentStructure: z.enum(["swiss", "swiss_top_cut", "single_elim"]).optional(),
  opsMode: z.enum(["native", "companion_linked"]).optional(),
  swissRounds: z.number().int().min(1).max(20).nullable().optional(),
  topCutSize: z.number().int().refine((n) => [2, 4, 8].includes(n)).nullable().optional(),
  allowLateEnrollment: z.boolean().optional(),
  awardLateByes: z.boolean().optional(),
  decklistRequired: z.boolean().optional(),
  decklistDeadline: z.string().nullable().optional(),
  companionEventCode: z.string().max(16).nullable().optional(),
});

export async function handleEventsManage(req: Request, params: RouteParams): Promise<Response> {
  const db = getDb();
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return error("Event not found", 404);

  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);
  const perms = await resolveEventPermissions(authUser, event);

  if (req.method === "PATCH") {
    if (!perms.canManage) return error("Only event organizer or staff can manage this event", 403);

    const parsed = updateEventSchema.safeParse(await req.json());
    if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Invalid input");

    // Ops mode / structure type only editable before start.
    // Swiss rounds + top cut size can be adjusted mid-tournament.
    if (event.status !== "upcoming") {
      if (parsed.data.tournamentStructure !== undefined || parsed.data.opsMode !== undefined) {
        return error(
          "Tournament structure type and ops mode can only be changed before the event starts",
          400,
        );
      }
    }

    const [updated] = await db
      .update(events)
      .set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.storeName !== undefined ? { storeName: parsed.data.storeName } : {}),
        ...(parsed.data.location !== undefined ? { location: parsed.data.location } : {}),
        ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
        ...(parsed.data.startsAt !== undefined ? { startsAt: new Date(parsed.data.startsAt) } : {}),
        ...(parsed.data.registrationDeadline !== undefined
          ? {
              registrationDeadline: parsed.data.registrationDeadline
                ? new Date(parsed.data.registrationDeadline)
                : null,
            }
          : {}),
        ...(parsed.data.maxPlayers !== undefined ? { maxPlayers: parsed.data.maxPlayers } : {}),
        ...(parsed.data.format !== undefined ? { format: parsed.data.format } : {}),
        ...(parsed.data.allowGuestRegistration !== undefined
          ? { allowGuestRegistration: parsed.data.allowGuestRegistration }
          : {}),
        ...(parsed.data.tournamentStructure !== undefined
          ? { tournamentStructure: parsed.data.tournamentStructure }
          : {}),
        ...(parsed.data.opsMode !== undefined ? { opsMode: parsed.data.opsMode } : {}),
        ...(parsed.data.swissRounds !== undefined ? { swissRounds: parsed.data.swissRounds } : {}),
        ...(parsed.data.topCutSize !== undefined ? { topCutSize: parsed.data.topCutSize } : {}),
        ...(parsed.data.allowLateEnrollment !== undefined
          ? { allowLateEnrollment: parsed.data.allowLateEnrollment }
          : {}),
        ...(parsed.data.awardLateByes !== undefined ? { awardLateByes: parsed.data.awardLateByes } : {}),
        ...(parsed.data.decklistRequired !== undefined
          ? { decklistRequired: parsed.data.decklistRequired }
          : {}),
        ...(parsed.data.decklistDeadline !== undefined
          ? {
              decklistDeadline: parsed.data.decklistDeadline
                ? new Date(parsed.data.decklistDeadline)
                : null,
            }
          : {}),
        ...(parsed.data.companionEventCode !== undefined
          ? {
              companionEventCode: parsed.data.companionEventCode?.trim().toUpperCase() || null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();

    // Keep Swiss phase roundCount in sync when organizers change swissRounds live
    if (updated && parsed.data.swissRounds !== undefined) {
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
      const playerCount = regs.length;
      const roundCount = resolvedSwissRoundCount(updated, playerCount);
      const activePhase = await getActivePhase(db, updated);
      const swissPhase =
        activePhase?.kind === "swiss"
          ? activePhase
          : (await getPhases(db, eventId)).find((p) => p.kind === "swiss");

      if (swissPhase) {
        const currentRound = swissPhase.currentRound ?? 0;
        const safeRoundCount = Math.max(roundCount, currentRound || 1);
        await db
          .update(eventPhases)
          .set({ roundCount: safeRoundCount, updatedAt: new Date() })
          .where(eq(eventPhases.id, swissPhase.id));
      }
    }

    return json({ event: updated });
  }

  if (req.method === "DELETE") {
    if (!perms.canDeleteEvent) return error("Only the event owner or admin can cancel this event", 403);
    const [updated] = await db
      .update(events)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(events.id, eventId))
      .returning();
    return json({ event: updated, message: "Event cancelled" });
  }

  return error("Method not allowed", 405);
}
