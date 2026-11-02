import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { emailVerificationTokens, users } from "../../db/schema";
import { error, json } from "../_shared/auth";

const verifySchema = z.object({ token: z.string().min(1) });

export async function handleAuthVerifyEmail(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const db = getDb();
  const body = verifySchema.safeParse(await req.json());
  if (!body.success) return error("Invalid token");

  const [record] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.token, body.data.token),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) return error("Invalid or expired token", 400);

  await db.update(users).set({ emailVerified: true }).where(eq(users.id, record.userId));
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));

  return json({ message: "Email verified successfully" });
}
