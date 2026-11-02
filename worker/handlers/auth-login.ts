import bcrypt from "bcryptjs";
import { z } from "zod";
import { error, findUserByLogin, json, signToken } from "../_shared/auth";
import { requireTurnstile } from "../_shared/turnstile";
import { publicUser } from "../_shared/users";

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
});

export async function handleAuthLogin(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const body = loginSchema.safeParse(await req.json());
  if (!body.success) return error("Invalid credentials");

  const captcha = await requireTurnstile(req, body.data.turnstileToken);
  if (captcha) return captcha;

  const user = await findUserByLogin(body.data.login);
  if (!user) return error("Invalid credentials", 401);

  const valid = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!valid) return error("Invalid credentials", 401);

  if (!user.emailVerified) {
    return json({ error: "Please verify your email before logging in", code: "EMAIL_NOT_VERIFIED" }, 403);
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });

  return json({
    token,
    user: publicUser(user),
  });
}
