import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db/index";
import { events, users } from "../../db/schema";
import { error, getAuthUser, json, type RouteParams } from "../_shared/auth";

export async function handleEventsJoin(req: Request, params: RouteParams): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);

  const code = params.code?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) return error("Invalid event code", 400);

  const db = getDb();
  const authUser = await getAuthUser(req);

  const [row] = await db
    .select({
      id: events.id,
      title: events.title,
      storeName: events.storeName,
      location: events.location,
      city: events.city,
      startsAt: events.startsAt,
      status: events.status,
      format: events.format,
      joinCode: events.joinCode,
      approvalStatus: events.approvalStatus,
      organizerId: events.organizerId,
      organizerName: sql<string>`trim(concat(${users.firstName}, ' ', ${users.lastName}))`.as("organizer_name"),
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(eq(events.joinCode, code))
    .limit(1);

  if (!row) return error("Event not found — check the code and try again", 404);

  if (
    row.approvalStatus !== "approved" &&
    (!authUser || (authUser.role !== "admin" && authUser.id !== row.organizerId))
  ) {
    return error("Event not available", 404);
  }

  if (row.status === "cancelled") return error("This event has been cancelled", 410);

  return json({ event: row });
}
