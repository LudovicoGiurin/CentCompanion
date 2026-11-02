import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { coordinatorRequests, users } from "../../db/schema";
import { error, getAuthUser, json, requireRole } from "../_shared/auth";

const reviewSchema = z.object({
  requestId: z.number(),
  action: z.enum(["approve", "reject"]),
  storeName: z.string().optional(),
});

export async function handleAdminReviewCoordinator(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authUser = await getAuthUser(req);
  if (!authUser || !requireRole(authUser, ["admin"])) {
    return error("Admin access required", 403);
  }

  const db = getDb();
  const body = reviewSchema.safeParse(await req.json());
  if (!body.success) return error("Invalid input");

  const [request] = await db
    .select()
    .from(coordinatorRequests)
    .where(eq(coordinatorRequests.id, body.data.requestId))
    .limit(1);

  if (!request || request.status !== "pending") {
    return error("Request not found or already reviewed", 404);
  }

  const status = body.data.action === "approve" ? "approved" : "rejected";

  await db
    .update(coordinatorRequests)
    .set({ status, reviewedBy: authUser.id, reviewedAt: new Date() })
    .where(eq(coordinatorRequests.id, request.id));

  if (body.data.action === "approve") {
    await db
      .update(users)
      .set({
        role: "coordinator",
        storeName: body.data.storeName ?? undefined,
      })
      .where(eq(users.id, request.userId));
  }

  return json({ message: `Request ${status}` });
}
