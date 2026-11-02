import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { emailVerificationTokens, users } from "../../db/schema";
import { error, json, randomToken } from "../_shared/auth";
import { normalizeName } from "../_shared/registrations";
import { appUrl, sendVerificationEmail } from "../_shared/email";
import { fetchRandomLegendaryArt } from "../_shared/scryfall";
import { requireTurnstile } from "../_shared/turnstile";

const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "Username may only contain letters, numbers, and underscores",
    }),
  password: z.string().min(8),
  firstName: z.string().min(1).max(64),
  lastName: z.string().min(1).max(64),
  turnstileToken: z.string().optional(),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy and Terms" }),
  }),
});

export async function handleAuthRegister(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const db = getDb();
  const raw = await req.json();
  const body = registerSchema.safeParse(raw);
  if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

  const captcha = await requireTurnstile(req, body.data.turnstileToken);
  if (captcha) return captcha;

  const { email, username, password, firstName, lastName } = body.data;
  const emailLower = email.toLowerCase();

  const existing = await db.select().from(users).where(eq(users.email, emailLower));
  if (existing.length) return error("Email already registered", 409);

  const existingUser = await db.select().from(users).where(eq(users.username, username));
  if (existingUser.length) return error("Username already taken", 409);

  const passwordHash = await bcrypt.hash(password, 12);
  // Default pfp: random legendary creature artwork from Scryfall.
  // Non-blocking on failure — assigned lazily on first profile load instead.
  const defaultArt = await fetchRandomLegendaryArt();
  const [user] = await db
    .insert(users)
    .values({
      email: emailLower,
      username,
      passwordHash,
      firstName: normalizeName(firstName),
      lastName: normalizeName(lastName),
      displayName: `${normalizeName(firstName)} ${normalizeName(lastName)}`.trim(),
      avatarUrl: defaultArt?.url ?? null,
    })
    .returning();

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    token,
    expiresAt,
  });

  const verifyUrl = appUrl(`/verify-email?token=${token}`);
  const emailed = await sendVerificationEmail(emailLower, token);

  return json(
    {
      message: emailed
        ? "Account created. Check your email to verify."
        : "Account created, but we could not send a verification email. Use resend verification or the link below.",
      userId: user.id,
      ...(!emailed ? { devVerifyUrl: verifyUrl } : {}),
    },
    201,
  );
}
