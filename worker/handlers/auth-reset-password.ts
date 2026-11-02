import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { passwordResetTokens, users } from "../../db/schema";
import { error, json } from "../_shared/auth";

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function handleAuthResetPassword(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const db = getDb();
  const body = resetSchema.safeParse(await req.json());
  if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, body.data.token),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) return error("Invalid or expired token", 400);

  const passwordHash = await bcrypt.hash(body.data.password, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, record.userId));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));

  return json({ message: "Password updated successfully" });
}
