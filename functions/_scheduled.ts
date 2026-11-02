import { initDb } from "../db/index";
import { syncOfficialContentToDb } from "../worker/_shared/sync-rules-db";
import type { Env } from "../worker/runtime";
import { setEnv } from "../worker/runtime";

export async function onSchedule(
  context: EventContext<Env, string, Record<string, unknown>>,
): Promise<void> {
  setEnv(context.env);
  initDb(context.env);
  for (const type of ["rules", "banlist"] as const) {
    await syncOfficialContentToDb(type);
  }
}
