import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { coordinatorRequests, users } from "../../db/schema";
import { error, getAuthUser, json, requireRole } from "../_shared/auth";

export async function handleAdminCoordinatorRequests(req: Request): Promise<Response> {
  const authUser = await getAuthUser(req);
  if (!authUser || !requireRole(authUser, ["admin"])) {
    return error("Admin access required", 403);
  }

  if (req.method === "GET") {
    const db = getDb();
    const requests = await db
      .select({
        id: coordinatorRequests.id,
        message: coordinatorRequests.message,
        contactInfo: coordinatorRequests.contactInfo,
        status: coordinatorRequests.status,
        createdAt: coordinatorRequests.createdAt,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
      })
      .from(coordinatorRequests)
      .innerJoin(users, eq(coordinatorRequests.userId, users.id))
      .where(eq(coordinatorRequests.status, "pending"));

    return json({ requests });
  }

  return error("Method not allowed", 405);
}
