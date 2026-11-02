import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { users } from "../../db/schema";
import { error, getAuthUser, json } from "../_shared/auth";
import { normalizeName } from "../_shared/registrations";
import { publicUser } from "../_shared/users";

const preferencesSchema = z.object({
  localLeagueCity: z.string().max(128).optional(),
  firstName: z.string().min(1).max(64).optional(),
  lastName: z.string().min(1).max(64).optional(),
});

export async function handleAuthPreferences(req: Request): Promise<Response> {
  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);

  if (req.method !== "PATCH") return error("Method not allowed", 405);

  const db = getDb();
  const body = preferencesSchema.safeParse(await req.json());
  if (!body.success) return error("Invalid input");

  const [user] = await db
    .update(users)
    .set({
      ...(body.data.localLeagueCity !== undefined
        ? { localLeagueCity: body.data.localLeagueCity.trim() || null }
        : {}),
      ...(body.data.firstName !== undefined ? { firstName: normalizeName(body.data.firstName) } : {}),
      ...(body.data.lastName !== undefined ? { lastName: normalizeName(body.data.lastName) } : {}),
      ...(body.data.firstName !== undefined || body.data.lastName !== undefined
        ? {
            displayName: `${normalizeName(body.data.firstName ?? authUser.firstName)} ${normalizeName(body.data.lastName ?? authUser.lastName)}`.trim(),
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, authUser.id))
    .returning();

  return json({ user: publicUser(user) });
}
