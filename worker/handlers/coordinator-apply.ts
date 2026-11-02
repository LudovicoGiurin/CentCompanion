import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { coordinatorRequests } from "../../db/schema";
import { error, getAuthUser, json } from "../_shared/auth";

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  contactInfo: z.string().min(1).max(500),
});

export async function handleCoordinatorApply(req: Request): Promise<Response> {
  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);

  const db = getDb();

  if (req.method === "POST") {
    if (authUser.role !== "user") {
      return error("Only regular users can apply for coordinator status", 400);
    }

    const existing = await db
      .select()
      .from(coordinatorRequests)
      .where(eq(coordinatorRequests.userId, authUser.id));
    const pending = existing.find((r) => r.status === "pending");
    if (pending) return error("You already have a pending request", 409);

    const body = requestSchema.safeParse(await req.json());
    if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

    const [request] = await db
      .insert(coordinatorRequests)
      .values({
        userId: authUser.id,
        message: body.data.message,
        contactInfo: body.data.contactInfo,
      })
      .returning();

    return json({ request }, 201);
  }

  if (req.method === "GET") {
    const [request] = await db
      .select()
      .from(coordinatorRequests)
      .where(eq(coordinatorRequests.userId, authUser.id))
      .orderBy(desc(coordinatorRequests.createdAt));
    return json({ requests: request ? [request] : [] });
  }

  return error("Method not allowed", 405);
}
