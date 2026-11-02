import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { metagameDecks } from "../../db/schema";
import { error, json } from "../_shared/auth";

export async function handleMetagame(req: Request): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);

  const db = getDb();
  const season = new URL(req.url).searchParams.get("season") ?? "2026";

  const decks = await db
    .select()
    .from(metagameDecks)
    .where(eq(metagameDecks.season, season))
    .orderBy(desc(metagameDecks.metaShare));

  return json({ season, decks });
}
