import type { Hyperdrive } from "@cloudflare/workers-types";

export type Env = {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
  COMPANION_ACCESS_TOKEN?: string;
  COMPANION_EMAIL?: string;
  COMPANION_PASSWORD?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
};

let currentEnv: Env | null = null;

export function setEnv(env: Env): void {
  currentEnv = env;
}

export function getEnv(): Env {
  if (!currentEnv) throw new Error("Env not initialized");
  return currentEnv;
}

const POSTGRES_URL_RE = /^postgres(?:ql)?:\/\/.+/i;

function normalizePostgresUrl(raw: string | undefined): string | undefined {
  const url = raw?.trim();
  if (!url) return undefined;
  return url;
}

/** Neon HTTP driver requires a direct `postgresql://…` URL — not Hyperdrive. */
export function connectionString(env: Env): string {
  const url =
    normalizePostgresUrl(env.DATABASE_URL) ??
    normalizePostgresUrl(env.HYPERDRIVE?.connectionString);

  if (!url) {
    throw new Error(
      "Database not configured. Set DATABASE_URL in Cloudflare Pages (Production) to your Neon connection string, e.g. postgresql://user:password@ep-….neon.tech/neondb?sslmode=require",
    );
  }

  if (!POSTGRES_URL_RE.test(url)) {
    throw new Error(
      "Invalid DATABASE_URL. Use your full Neon connection string starting with postgresql:// (copy it from the Neon dashboard → Connect).",
    );
  }

  return url;
}
