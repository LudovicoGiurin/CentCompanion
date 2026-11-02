import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import {
  coordinatorRequests,
  emailVerificationTokens,
  eventRegistrations,
  events,
  leaderboardEntries,
  passwordResetTokens,
  users,
} from "../../db/schema";
import { error, getAuthUser, json, randomToken } from "../_shared/auth";

const deleteSchema = z.object({
  password: z.string().min(1),
  confirm: z.literal(true, { errorMap: () => ({ message: "Confirmation required" }) }),
});

export async function handleAuthDeleteAccount(req: Request): Promise<Response> {
  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);
  if (req.method !== "POST") return error("Method not allowed", 405);

  const body = deleteSchema.safeParse(await req.json());
  if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

  if (authUser.role === "admin") {
    return error("Admin accounts cannot be deleted here. Contact privacy@centcomp.net.", 403);
  }

  const valid = await bcrypt.compare(body.data.password, authUser.passwordHash);
  if (!valid) return error("Password is incorrect", 401);

  const db = getDb();

  const activeEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.organizerId, authUser.id),
        inArray(events.status, ["upcoming", "ongoing"]),
      ),
    );
  if (activeEvents.length > 0) {
    return error(
      "Cancel or complete events you organize before deleting your account.",
      409,
    );
  }

  const userId = authUser.id;
  const anonSuffix = randomToken().slice(0, 10);

  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.delete(leaderboardEntries).where(eq(leaderboardEntries.userId, userId));
  await db.delete(coordinatorRequests).where(eq(coordinatorRequests.userId, userId));

  const userRegs = await db
    .select({ id: eventRegistrations.id, eventId: eventRegistrations.eventId })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.userId, userId));

  for (const reg of userRegs) {
    const [ev] = await db.select({ status: events.status }).from(events).where(eq(events.id, reg.eventId)).limit(1);
    if (ev?.status === "upcoming") {
      await db.delete(eventRegistrations).where(eq(eventRegistrations.id, reg.id));
    } else {
      await db
        .update(eventRegistrations)
        .set({
          firstName: "Former",
          lastName: "Player",
          moxfieldUrl: null,
          deckName: null,
          updatedAt: new Date(),
        })
        .where(eq(eventRegistrations.id, reg.id));
    }
  }

  await db
    .update(users)
    .set({
      email: `deleted-${userId}-${anonSuffix}@anonymized.centcomp.invalid`,
      username: `deleted_${userId}_${anonSuffix}`,
      passwordHash: await bcrypt.hash(randomToken(), 12),
      firstName: "Deleted",
      lastName: "User",
      displayName: "Deleted User",
      storeName: null,
      localLeagueCity: null,
      emailVerified: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return json({
    message:
      "Account deleted. Personal data has been removed or anonymized. Tournament records may retain a generic player label.",
  });
}
