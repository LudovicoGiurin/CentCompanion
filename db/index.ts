import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { Env } from "../worker/runtime";
import { connectionString, getEnv } from "../worker/runtime";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

let db: Db | null = null;
let cachedUrl: string | null = null;

function createDb(env: Env): Db {
  const url = connectionString(env);
  if (db && cachedUrl === url) return db;
  db = drizzle(url, { schema });
  cachedUrl = url;
  return db;
}

/** @deprecated use getDb(); kept for scheduled jobs */
export function initDb(env: Env): Db {
  return createDb(env);
}

export function getDb(): Db {
  if (!db) return createDb(getEnv());
  return db;
}

export async function closeDb(): Promise<void> {
  // Neon HTTP driver issues stateless fetch requests — no persistent connection.
}

export { schema };
