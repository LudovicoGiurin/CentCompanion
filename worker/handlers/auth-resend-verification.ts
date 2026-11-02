import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { emailVerificationTokens, users } from "../../db/schema";
import { error, findUserByLogin, json, randomToken } from "../_shared/auth";
import { appUrl, sendVerificationEmail } from "../_shared/email";
import { requireTurnstile } from "../_shared/turnstile";

const resendSchema = z.object({
  login: z.string().min(1),
  turnstileToken: z.string().optional(),
});

export async function handleAuthResendVerification(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const body = resendSchema.safeParse(await req.json());
  if (!body.success) return error("Invalid input");

  const captcha = await requireTurnstile(req, body.data.turnstileToken);
  if (captcha) return captcha;

  const user = await findUserByLogin(body.data.login);
  if (!user || user.emailVerified) {
    return json({
      message: "If an unverified account exists, a new verification link has been sent.",
    });
  }

  const db = getDb();
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, user.id));

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    token,
    expiresAt,
  });

  const verifyUrl = appUrl(`/verify-email?token=${token}`);
  const emailed = await sendVerificationEmail(user.email, token);

  return json({
    message: emailed
      ? "Verification email sent. Check your inbox (and spam folder)."
      : "We could not send email — mail is not configured on the server. Use the link below if shown.",
    ...(!emailed ? { devVerifyUrl: verifyUrl } : {}),
  });
}
