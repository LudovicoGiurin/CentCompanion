import { and, eq, gte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { eventRegistrations, events, users } from "../../db/schema";
import { error, getAuthUser, json, requireRole } from "../_shared/auth";
import { uniqueJoinCode } from "../_shared/join-code";

const createEventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  storeName: z.string().min(2),
  location: z.string().optional(),
  city: z.string().max(128).optional(),
  eventType: z.enum(["casual", "local_league", "lv1", "lv2"]).default("casual"),
  startsAt: z.string().optional(),
  startsAtDates: z.array(z.string()).optional(),
  registrationDeadline: z.string().optional(),
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

export async function handleEvents(req: Request): Promise<Response> {
  const db = getDb();

  if (req.method === "GET") {
    const authUser = await getAuthUser(req);
    const visibilityFilter = authUser
      ? or(eq(events.approvalStatus, "approved"), eq(events.organizerId, authUser.id))
      : eq(events.approvalStatus, "approved");

    const upcoming = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        storeName: events.storeName,
        location: events.location,
        city: events.city,
        eventType: events.eventType,
        approvalStatus: events.approvalStatus,
        startsAt: events.startsAt,
        registrationDeadline: events.registrationDeadline,
        maxPlayers: events.maxPlayers,
        format: events.format,
        status: events.status,
        organizerId: events.organizerId,
        organizerName: sql<string>`trim(concat(${users.firstName}, ' ', ${users.lastName}))`.as("organizer_name"),
        allowGuestRegistration: events.allowGuestRegistration,
        registrationCount: sql<number>`(
          select count(*)::int from ${eventRegistrations}
          where ${eventRegistrations.eventId} = ${events.id}
            and ${eventRegistrations.registrationStatus} = 'confirmed'
        )`.as("registration_count"),
        isRegistered: authUser
          ? sql<boolean>`(
              select exists(
                select 1 from ${eventRegistrations}
                where ${eventRegistrations.eventId} = ${events.id}
                  and ${eventRegistrations.userId} = ${authUser.id}
                  and ${eventRegistrations.registrationStatus} <> 'dropped'
              )
            )`.as("is_registered")
          : sql<boolean>`false`.as("is_registered"),
      })
      .from(events)
      .leftJoin(users, eq(events.organizerId, users.id))
      .where(
        and(
          gte(events.startsAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
          ne(events.status, "cancelled"),
          visibilityFilter,
        ),
      )
      .orderBy(events.startsAt);

    return json({ events: upcoming });
  }

  if (req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser) return error("Unauthorized", 401);
    if (!requireRole(authUser, ["coordinator", "admin"])) {
      return error("Coordinator access required", 403);
    }

    const body = createEventSchema.safeParse(await req.json());
    if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");
    if (!body.data.startsAt && (!body.data.startsAtDates || body.data.startsAtDates.length === 0)) {
      return error("At least one event date is required");
    }

    if (body.data.eventType === "local_league" && !body.data.location?.trim()) {
      return error("Location is required for local league events");
    }

    if (body.data.eventType === "local_league" && !body.data.city?.trim()) {
      return error("City could not be determined from location");
    }

    if (body.data.eventType !== "local_league" && body.data.startsAtDates && body.data.startsAtDates.length > 1) {
      return error("Multiple dates are only supported for local league events");
    }

    const approvalStatus: "approved" | "pending_review" =
      body.data.eventType === "lv1" || body.data.eventType === "lv2"
        ? "pending_review"
        : "approved";

    const uniqueDates = [
      ...(body.data.startsAtDates ?? []),
      ...(body.data.startsAt ? [body.data.startsAt] : []),
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index);

    const createdEvents = await db
      .insert(events)
      .values(
        await Promise.all(
          uniqueDates.map(async (start) => ({
            title: body.data.title,
            description: body.data.description,
            storeName: body.data.storeName,
            location: body.data.location,
            city: body.data.city,
            organizerId: authUser.id,
            eventType: body.data.eventType,
            approvalStatus,
            startsAt: new Date(start),
            registrationDeadline: body.data.registrationDeadline
              ? new Date(body.data.registrationDeadline)
              : undefined,
            maxPlayers: body.data.maxPlayers ?? 32,
            format: body.data.format ?? "Swiss",
            allowGuestRegistration: body.data.allowGuestRegistration ?? true,
            tournamentStructure: body.data.tournamentStructure ?? "swiss",
            opsMode: body.data.opsMode ?? "native",
            swissRounds: body.data.swissRounds ?? null,
            topCutSize: body.data.topCutSize ?? null,
            allowLateEnrollment: body.data.allowLateEnrollment ?? false,
            awardLateByes: body.data.awardLateByes ?? false,
            decklistRequired: body.data.decklistRequired ?? false,
            decklistDeadline: body.data.decklistDeadline
              ? new Date(body.data.decklistDeadline)
              : null,
            companionEventCode: body.data.companionEventCode?.trim().toUpperCase() || null,
            joinCode: await uniqueJoinCode(db),
          })),
        ),
      )
      .returning();

    return json(
      {
        event: createdEvents[0],
        events: createdEvents,
        pendingApproval: approvalStatus === "pending_review",
      },
      201,
    );
  }

  return error("Method not allowed", 405);
}
