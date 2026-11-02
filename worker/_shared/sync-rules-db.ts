import { eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { rulesContent } from "../../db/schema";
import { fetchOfficialContent, hashContent, type OfficialContentType } from "./sync";

export async function syncOfficialContentToDb(
  type: OfficialContentType,
): Promise<"unchanged" | "updated" | "created"> {
  const db = getDb();
  const contentHtml = await fetchOfficialContent(type);
  const sourceHash = hashContent(contentHtml);

  const [existing] = await db
    .select()
    .from(rulesContent)
    .where(eq(rulesContent.type, type))
    .limit(1);

  if (existing?.sourceHash === sourceHash) return "unchanged";

  if (existing) {
    await db
      .update(rulesContent)
      .set({ contentHtml, sourceHash, syncedAt: new Date(), updatedAt: new Date() })
      .where(eq(rulesContent.id, existing.id));
    return "updated";
  }

  await db.insert(rulesContent).values({ type, contentHtml, sourceHash });
  return "created";
}
