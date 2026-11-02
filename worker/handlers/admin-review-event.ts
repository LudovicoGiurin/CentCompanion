import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { events } from "../../db/schema";
import { error, getAuthUser, json, requireRole } from "../_shared/auth";

const reviewSchema = z.object({
  eventId: z.number(),
  action: z.enum(["approve", "reject"]),
});

export async function handleAdminReviewEvent(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authUser = await getAuthUser(req);
  if (!authUser || !requireRole(authUser, ["admin"])) {
    return error("Admin access required", 403);
  }

  const db = getDb();
  const body = reviewSchema.safeParse(await req.json());
  if (!body.success) return error("Invalid input");

  const [event] = await db.select().from(events).where(eq(events.id, body.data.eventId)).limit(1);
  if (!event || event.approvalStatus !== "pending_review") {
    return error("Event not found or already reviewed", 404);
  }

  const approvalStatus = body.data.action === "approve" ? "approved" : "rejected";
  await db
    .update(events)
    .set({
      approvalStatus,
      approvedBy: authUser.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id));

  return json({ message: `Event ${approvalStatus}` });
}
