import { getEnv } from "../runtime";
import { error } from "./auth";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(token: string, remoteIp?: string | null): Promise<boolean> {
  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return true;

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  if (!res.ok) return false;

  const data = (await res.json()) as TurnstileVerifyResponse;
  if (!data.success) {
    console.warn("[Turnstile] verification failed:", data["error-codes"]?.join(", ") ?? "unknown");
  }
  return data.success;
}

/** Returns an error Response when verification fails; null when OK (or Turnstile disabled). */
export async function requireTurnstile(req: Request, token: string | undefined): Promise<Response | null> {
  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return null;

  if (!token?.trim()) return error("Captcha verification required", 400);

  const ip = req.headers.get("CF-Connecting-IP");
  const ok = await verifyTurnstileToken(token.trim(), ip);
  if (!ok) return error("Captcha verification failed — please try again", 403);

  return null;
}
