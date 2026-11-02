import { randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { Resend } from "resend";
import { getDb } from "../../db/index";
import { magicLinkTokens, oauthAccounts, users, events as eventsTable } from "../../db/schema";
import { error, json, signToken } from "../_shared/auth";
import { getEnv } from "../runtime";
import { checkRateLimit } from "../_shared/rate-limit";
import { fetchRandomLegendaryArt } from "../_shared/scryfall";

function appUrl() {
  return (getEnv().APP_URL ?? "http://localhost:8788").replace(/\/$/, "");
}

function usernameFromEmail(email: string): string {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 48);
  return base || "player";
}

async function uniqueUsername(db: ReturnType<typeof getDb>, base: string) {
  let username = base.slice(0, 64);
  let n = 0;
  while (true) {
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (!exists) return username;
    n += 1;
    username = `${base.slice(0, 60)}_${n}`;
  }
}

export async function handleAuthOAuthStart(req: Request): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const returnTo = url.searchParams.get("return") || "/profile";
  const native = url.searchParams.get("native") === "1";
  if (provider !== "google" && provider !== "discord") return error("Unsupported provider", 400);

  const env = getEnv();
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim();
  const discordClientId = env.DISCORD_CLIENT_ID?.trim();

  const state = Buffer.from(
    JSON.stringify({ returnTo, provider, native, n: randomBytes(8).toString("hex") }),
  ).toString("base64url");
  const redirectUri = `${appUrl()}/api/auth/oauth/callback`;

  if (provider === "google") {
    if (!googleClientId) {
      return error(
        "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the Cloudflare Pages project (Production), then redeploy.",
        503,
      );
    }
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.searchParams.set("client_id", googleClientId);
    auth.searchParams.set("redirect_uri", redirectUri);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", "openid email profile");
    auth.searchParams.set("state", state);
    auth.searchParams.set("access_type", "online");
    auth.searchParams.set("prompt", "select_account");
    return Response.redirect(auth.toString(), 302);
  }

  if (!discordClientId) {
    return error(
      "Discord OAuth not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET on the Cloudflare Pages project (Production), then redeploy.",
      503,
    );
  }
  const auth = new URL("https://discord.com/api/oauth2/authorize");
  auth.searchParams.set("client_id", discordClientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "identify email");
  auth.searchParams.set("state", state);
  return Response.redirect(auth.toString(), 302);
}

export async function handleAuthOAuthCallback(req: Request): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) return error("Missing code/state", 400);

  let state: { returnTo?: string; provider?: string; native?: boolean };
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
  } catch {
    return error("Invalid state", 400);
  }
  const provider = state.provider === "discord" ? "discord" : "google";
  const env = getEnv();
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const discordClientId = env.DISCORD_CLIENT_ID?.trim();
  const discordClientSecret = env.DISCORD_CLIENT_SECRET?.trim();
  const redirectUri = `${appUrl()}/api/auth/oauth/callback`;

  let providerUserId: string;
  let email: string;
  let firstName = "";
  let lastName = "";

  if (provider === "google") {
    if (!googleClientId || !googleClientSecret) {
      return error(
        "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the Cloudflare Pages project (Production), then redeploy.",
        503,
      );
    }
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return error("Google token exchange failed", 502);
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return error("Google token missing", 502);
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) return error("Google profile fetch failed", 502);
    const profile = (await profileRes.json()) as {
      id: string;
      email?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
    };
    providerUserId = profile.id;
    email = (profile.email ?? "").toLowerCase();
    firstName = profile.given_name ?? profile.name?.split(" ")[0] ?? "Player";
    lastName = profile.family_name ?? profile.name?.split(" ").slice(1).join(" ") ?? "";
  } else {
    if (!discordClientId || !discordClientSecret) {
      return error(
        "Discord OAuth not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET on the Cloudflare Pages project (Production), then redeploy.",
        503,
      );
    }
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: discordClientId,
        client_secret: discordClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return error("Discord token exchange failed", 502);
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return error("Discord token missing", 502);
    const profileRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) return error("Discord profile fetch failed", 502);
    const profile = (await profileRes.json()) as {
      id: string;
      email?: string;
      global_name?: string;
      username?: string;
    };
    providerUserId = profile.id;
    email = (profile.email ?? `${profile.id}@discord.oauth.local`).toLowerCase();
    const display = profile.global_name ?? profile.username ?? "Player";
    firstName = display.split(" ")[0] ?? "Player";
    lastName = display.split(" ").slice(1).join(" ");
  }

  if (!email) return error("OAuth provider did not return an email", 400);

  const db = getDb();
  const [linked] = await db
    .select()
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUserId)))
    .limit(1);

  let userId: number;
  if (linked) {
    userId = linked.userId;
  } else {
    const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (byEmail) {
      userId = byEmail.id;
      await db.insert(oauthAccounts).values({
        userId,
        provider,
        providerUserId,
        providerEmail: email,
      });
      await db
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      const username = await uniqueUsername(db, usernameFromEmail(email));
      const defaultArt = await fetchRandomLegendaryArt();
      const [created] = await db
        .insert(users)
        .values({
          email,
          username,
          passwordHash: `!oauth-${provider}!`,
          firstName,
          lastName,
          emailVerified: true,
          avatarUrl: defaultArt?.url ?? null,
        })
        .returning();
      userId = created.id;
      await db.insert(oauthAccounts).values({
        userId,
        provider,
        providerUserId,
        providerEmail: email,
      });
    }
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return error("User missing", 500);

  const token = signToken({
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });

  const returnTo = typeof state.returnTo === "string" && state.returnTo.startsWith("/") ? state.returnTo : "/profile";
  const complete = new URL(`${appUrl()}/oauth/complete`);
  complete.searchParams.set("token", token);
  complete.searchParams.set("return", returnTo);
  if (state.native) complete.searchParams.set("native", "1");
  return Response.redirect(complete.toString(), 302);
}

const magicLinkSchema = z.object({
  login: z.string().min(1),
  turnstileToken: z.string().optional(),
});

export async function handleAuthMagicLinkRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);
  const rate = checkRateLimit(`magic:${req.headers.get("cf-connecting-ip") ?? "x"}`, 10, 60_000);
  if (!rate.ok) return error("Too many requests", 429);

  const body = magicLinkSchema.safeParse(await req.json());
  if (!body.success) return error("Invalid input");

  const db = getDb();
  const login = body.data.login.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, login))
    .limit(1);

  // Always return success to avoid account enumeration
  if (!user) {
    return json({ message: "If an account exists, a magic link was sent." });
  }

  const token = randomBytes(32).toString("hex");
  await db.insert(magicLinkTokens).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  const link = `${appUrl()}/magic-login?token=${token}`;
  const resendKey = getEnv().RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    await resend.emails
      .send({
        from: getEnv().EMAIL_FROM ?? "Cent Companion <noreply@centcomp.net>",
        to: user.email,
        subject: "Your Cent Companion login link",
        html: `<p>Click to sign in:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes.</p>`,
      })
      .catch(() => undefined);
  } else {
    console.warn("[EMAIL] Magic link (no RESEND_API_KEY):", link);
  }

  const isDev = !(getEnv().APP_URL ?? "").includes("centcomp.net");
  return json({
    message: "If an account exists, a magic link was sent.",
    ...(isDev ? { devMagicUrl: link } : {}),
  });
}

export async function handleAuthMagicLinkConsume(req: Request): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);
  const body = z.object({ token: z.string().min(10) }).safeParse(await req.json());
  if (!body.success) return error("Invalid token");

  const db = getDb();
  const [row] = await db
    .select()
    .from(magicLinkTokens)
    .where(and(eq(magicLinkTokens.token, body.data.token), gt(magicLinkTokens.expiresAt, new Date())))
    .limit(1);
  if (!row) return error("Invalid or expired link", 400);

  await db.delete(magicLinkTokens).where(eq(magicLinkTokens.id, row.id));
  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) return error("User not found", 404);

  const token = signToken({
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });

  return json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      storeName: user.storeName,
      localLeagueCity: user.localLeagueCity,
    },
  });
}

export async function handleOrganizerProfile(req: Request, params: { id: string }): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);
  const userId = Number(params.id);
  if (!userId) return error("Invalid id");

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      storeName: users.storeName,
      localLeagueCity: users.localLeagueCity,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return error("Not found", 404);
  if (user.role !== "coordinator" && user.role !== "admin") {
    return error("Not an organizer profile", 404);
  }

  const organized = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      storeName: eventsTable.storeName,
      city: eventsTable.city,
      startsAt: eventsTable.startsAt,
      status: eventsTable.status,
      eventType: eventsTable.eventType,
    })
    .from(eventsTable)
    .where(and(eq(eventsTable.organizerId, userId), eq(eventsTable.approvalStatus, "approved")))
    .limit(50);

  return json({
    organizer: {
      id: user.id,
      username: user.username,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
      storeName: user.storeName,
      localLeagueCity: user.localLeagueCity,
    },
    events: organized,
  });
}
