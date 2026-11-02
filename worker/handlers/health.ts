import { sql } from "drizzle-orm";
import { getDb } from "../../db/index";
import { json, error } from "../_shared/auth";

export async function handleHealth(req: Request): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return json({ ok: true, db: true, ts: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DB error";
    return json({ ok: false, db: false, error: message, ts: new Date().toISOString() }, 503);
  }
}
