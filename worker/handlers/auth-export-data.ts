import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import {
  coordinatorRequests,
  eventRegistrations,
  events,
  leaderboardEntries,
  users,
} from "../../db/schema";
import { error, getAuthUser, json } from "../_shared/auth";

export async function handleAuthExportData(req: Request): Promise<Response> {
  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);
  if (req.method !== "GET") return error("Method not allowed", 405);

  const db = getDb();
  const userId = authUser.id;

  const [profile] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      emailVerified: users.emailVerified,
      firstName: users.firstName,
      lastName: users.lastName,
      storeName: users.storeName,
      localLeagueCity: users.localLeagueCity,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const registrations = await db
    .select({
      id: eventRegistrations.id,
      eventId: eventRegistrations.eventId,
      firstName: eventRegistrations.firstName,
      lastName: eventRegistrations.lastName,
      moxfieldUrl: eventRegistrations.moxfieldUrl,
      deckName: eventRegistrations.deckName,
      registrationStatus: eventRegistrations.registrationStatus,
      registeredAt: eventRegistrations.registeredAt,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.userId, userId));

  const standings = await db
    .select()
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.userId, userId));

  const coordinatorApps = await db
    .select({
      id: coordinatorRequests.id,
      message: coordinatorRequests.message,
      contactInfo: coordinatorRequests.contactInfo,
      status: coordinatorRequests.status,
      createdAt: coordinatorRequests.createdAt,
    })
    .from(coordinatorRequests)
    .where(eq(coordinatorRequests.userId, userId));

  const organizedEvents = await db
    .select({
      id: events.id,
      title: events.title,
      storeName: events.storeName,
      city: events.city,
      status: events.status,
      startsAt: events.startsAt,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.organizerId, userId));

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    profile,
    eventRegistrations: registrations,
    leaderboardEntries: standings,
    coordinatorApplications: coordinatorApps,
    organizedEvents,
  };

  return new Response(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="cent-companion-data-${userId}.json"`,
    },
  });
}
