import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { events, users } from "../../db/schema";
import { error, getAuthUser, json, requireRole } from "../_shared/auth";

export async function handleAdminEventRequests(req: Request): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);

  const authUser = await getAuthUser(req);
  if (!authUser || !requireRole(authUser, ["admin"])) {
    return error("Admin access required", 403);
  }

  const db = getDb();
  const requests = await db
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
      organizerName: users.displayName,
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(
      and(
        eq(events.approvalStatus, "pending_review"),
        eq(events.status, "upcoming"),
      ),
    );

  return json({ requests });
}
