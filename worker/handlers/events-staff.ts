import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { eventStaff, events, users } from "../../db/schema";
import { error, getAuthUser, json, type RouteParams } from "../_shared/auth";
import { resolveEventPermissions } from "../_shared/event-permissions";
import { formatPlayerName } from "../_shared/registrations";

const addStaffSchema = z.object({
  login: z.string().min(1),
  role: z.enum(["co_organizer", "judge", "scorekeeper"]),
});

const updateStaffSchema = z.object({
  userId: z.number(),
  role: z.enum(["co_organizer", "judge", "scorekeeper"]).optional(),
  remove: z.boolean().optional(),
});

export async function handleEventsStaff(req: Request, params: RouteParams): Promise<Response> {
  const db = getDb();
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return error("Event not found", 404);

  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);
  const perms = await resolveEventPermissions(authUser, event);

  if (req.method === "GET") {
    if (!perms.canManage && !perms.canViewDecklists) {
      return error("Forbidden", 403);
    }
    const rows = await db
      .select({
        id: eventStaff.id,
        userId: eventStaff.userId,
        role: eventStaff.role,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(eventStaff)
      .innerJoin(users, eq(eventStaff.userId, users.id))
      .where(eq(eventStaff.eventId, eventId));

    return json({
      staff: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        role: r.role,
        username: r.username,
        displayName: formatPlayerName(r.firstName, r.lastName, r.username),
        email: r.email,
      })),
      permissions: perms,
    });
  }

  if (!perms.canManageStaff) return error("Forbidden", 403);

  if (req.method === "POST") {
    const body = addStaffSchema.safeParse(await req.json());
    if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

    const login = body.data.login.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(or(sql`lower(${users.email}) = ${login}`, sql`lower(${users.username}) = ${login}`))
      .limit(1);
    if (!user) return error("User not found", 404);
    if (user.id === event.organizerId) return error("Event owner is already the organizer", 400);

    const [existing] = await db
      .select()
      .from(eventStaff)
      .where(and(eq(eventStaff.eventId, eventId), eq(eventStaff.userId, user.id)))
      .limit(1);
    if (existing) return error("User is already on staff", 409);

    const [row] = await db
      .insert(eventStaff)
      .values({ eventId, userId: user.id, role: body.data.role })
      .returning();

    return json(
      {
        staff: {
          id: row.id,
          userId: user.id,
          role: row.role,
          username: user.username,
          displayName: formatPlayerName(user.firstName, user.lastName, user.username),
        },
      },
      201,
    );
  }

  if (req.method === "PATCH") {
    const body = updateStaffSchema.safeParse(await req.json());
    if (!body.success) return error("Invalid input");

    if (body.data.remove) {
      await db
        .delete(eventStaff)
        .where(and(eq(eventStaff.eventId, eventId), eq(eventStaff.userId, body.data.userId)));
      return json({ message: "Staff member removed" });
    }

    if (!body.data.role) return error("Role required", 400);
    const [row] = await db
      .update(eventStaff)
      .set({ role: body.data.role })
      .where(and(eq(eventStaff.eventId, eventId), eq(eventStaff.userId, body.data.userId)))
      .returning();
    if (!row) return error("Staff member not found", 404);
    return json({ staff: row });
  }

  return error("Method not allowed", 405);
}
