import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { error, getAuthUser, json } from "../_shared/auth";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function handleAuthChangePassword(req: Request): Promise<Response> {
  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);

  if (req.method !== "POST") return error("Method not allowed", 405);

  const body = changePasswordSchema.safeParse(await req.json());
  if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

  const valid = await bcrypt.compare(body.data.currentPassword, authUser.passwordHash);
  if (!valid) return error("Current password is incorrect", 401);

  const db = getDb();
  const passwordHash = await bcrypt.hash(body.data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, authUser.id));

  return json({ message: "Password updated successfully" });
}
