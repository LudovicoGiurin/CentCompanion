import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { rulesContent } from "../../db/schema";
import {
  DEFAULT_BANLIST_HTML,
  DEFAULT_RULES_HTML,
  hashContent,
} from "../_shared/sync";
import { syncOfficialContentToDb } from "../_shared/sync-rules-db";
import { error, getAuthUser, json, requireRole } from "../_shared/auth";

const updateSchema = z.object({
  type: z.enum(["rules", "banlist"]),
  contentHtml: z.string().min(10),
});

async function getOrDefault(type: "rules" | "banlist") {
  const db = getDb();
  const [row] = await db
    .select()
    .from(rulesContent)
    .where(eq(rulesContent.type, type))
    .orderBy(desc(rulesContent.updatedAt))
    .limit(1);

  if (row) return row;
  const fallback = type === "rules" ? DEFAULT_RULES_HTML : DEFAULT_BANLIST_HTML;
  return {
    type,
    contentHtml: fallback,
    syncedAt: null,
    sourceHash: null,
  };
}

export async function handleRules(req: Request): Promise<Response> {
  if (req.method === "GET") {
    const type = new URL(req.url).searchParams.get("type") as "rules" | "banlist" | null;
    if (type) {
      const content = await getOrDefault(type);
      return json({ content });
    }
    const [rules, banlist] = await Promise.all([
      getOrDefault("rules"),
      getOrDefault("banlist"),
    ]);
    return json({ rules, banlist });
  }

  if (req.method === "POST") {
    const action = new URL(req.url).searchParams.get("action");

    if (action === "sync") {
      const authUser = await getAuthUser(req);
      if (!authUser || !requireRole(authUser, ["admin"])) {
        return error("Admin access required", 403);
      }

      const results: Record<string, string> = {};
      for (const type of ["rules", "banlist"] as const) {
        results[type] = await syncOfficialContentToDb(type);
      }

      return json({ message: "Sync complete", results });
    }

    const authUser = await getAuthUser(req);
    if (!authUser || !requireRole(authUser, ["admin"])) {
      return error("Admin access required", 403);
    }

    const db = getDb();
    const body = updateSchema.safeParse(await req.json());
    if (!body.success) return error("Invalid input");

    const [existing] = await db
      .select()
      .from(rulesContent)
      .where(eq(rulesContent.type, body.data.type))
      .limit(1);

    if (existing) {
      await db
        .update(rulesContent)
        .set({
          contentHtml: body.data.contentHtml,
          sourceHash: hashContent(body.data.contentHtml),
          updatedAt: new Date(),
        })
        .where(eq(rulesContent.id, existing.id));
    } else {
      await db.insert(rulesContent).values({
        type: body.data.type,
        contentHtml: body.data.contentHtml,
        sourceHash: hashContent(body.data.contentHtml),
      });
    }

    return json({ message: "Content updated" });
  }

  return error("Method not allowed", 405);
}
