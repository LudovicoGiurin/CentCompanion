import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { newsPosts, users } from "../../db/schema";
import { error, getAuthUser, json, requireRole } from "../_shared/auth";

const postSchema = z.object({
  title: z.string().min(3),
  excerpt: z.string().optional(),
  content: z.string().min(10),
  published: z.boolean().optional(),
});

export async function handleNews(req: Request): Promise<Response> {
  const db = getDb();

  if (req.method === "GET") {
    const posts = await db
      .select({
        id: newsPosts.id,
        title: newsPosts.title,
        excerpt: newsPosts.excerpt,
        content: newsPosts.content,
        published: newsPosts.published,
        createdAt: newsPosts.createdAt,
        authorName: users.displayName,
      })
      .from(newsPosts)
      .leftJoin(users, eq(newsPosts.authorId, users.id))
      .where(eq(newsPosts.published, true))
      .orderBy(desc(newsPosts.createdAt))
      .limit(20);

    return json({ posts });
  }

  if (req.method === "POST") {
    const authUser = await getAuthUser(req);
    if (!authUser) return error("Unauthorized", 401);
    if (!requireRole(authUser, ["admin"])) return error("Admin access required", 403);

    const body = postSchema.safeParse(await req.json());
    if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

    const [post] = await db
      .insert(newsPosts)
      .values({
        title: body.data.title,
        excerpt: body.data.excerpt,
        content: body.data.content,
        published: body.data.published ?? true,
        authorId: authUser.id,
      })
      .returning();

    return json({ post }, 201);
  }

  return error("Method not allowed", 405);
}
