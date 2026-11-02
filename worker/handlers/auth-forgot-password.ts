import { z } from "zod";
import { getDb } from "../../db/index";
import { passwordResetTokens } from "../../db/schema";
import { error, findUserByLogin, json, randomToken } from "../_shared/auth";
import { sendPasswordResetEmail } from "../_shared/email";
import { requireTurnstile } from "../_shared/turnstile";

const forgotSchema = z.object({
  login: z.string().min(1),
  turnstileToken: z.string().optional(),
});

export async function handleAuthForgotPassword(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const db = getDb();
  const body = forgotSchema.safeParse(await req.json());
  if (!body.success) return error("Invalid input");

  const captcha = await requireTurnstile(req, body.data.turnstileToken);
  if (captcha) return captcha;

  const user = await findUserByLogin(body.data.login);
  if (user) {
    const token = randomToken();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await sendPasswordResetEmail(user.email, token);
  }

  return json({ message: "If an account exists, a reset link has been sent." });
}
