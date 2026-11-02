import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/index";
import { eventStaff, events, type Event, type User } from "../../db/schema";
import { requireRole } from "./auth";

export type EventStaffRole = "co_organizer" | "judge" | "scorekeeper";

export type EventPermissions = {
  isOwner: boolean;
  isAdmin: boolean;
  staffRole: EventStaffRole | null;
  canManage: boolean;
  canEditPairings: boolean;
  canScore: boolean;
  canDrop: boolean;
  canViewDecklists: boolean;
  canDeleteEvent: boolean;
  canManageStaff: boolean;
};

export async function getStaffRole(
  db: ReturnType<typeof getDb>,
  eventId: number,
  userId: number,
): Promise<EventStaffRole | null> {
  const [row] = await db
    .select({ role: eventStaff.role })
    .from(eventStaff)
    .where(and(eq(eventStaff.eventId, eventId), eq(eventStaff.userId, userId)))
    .limit(1);
  return (row?.role as EventStaffRole | undefined) ?? null;
}

export async function resolveEventPermissions(
  authUser: User | { id: number; role: User["role"] },
  event: Pick<Event, "id" | "organizerId">,
): Promise<EventPermissions> {
  const db = getDb();
  const isAdmin = requireRole(authUser as User, ["admin"]);
  const isOwner = event.organizerId === authUser.id;
  const staffRole = isOwner || isAdmin ? null : await getStaffRole(db, event.id, authUser.id);

  const canManage = isAdmin || isOwner || staffRole === "co_organizer";
  const canEditPairings = canManage || staffRole === "judge";
  const canScore = canEditPairings || staffRole === "scorekeeper";
  const canDrop = canManage || staffRole === "judge";
  const canViewDecklists = canManage || staffRole === "judge" || staffRole === "scorekeeper";
  const canDeleteEvent = isAdmin || isOwner;
  const canManageStaff = isAdmin || isOwner || staffRole === "co_organizer";

  return {
    isOwner,
    isAdmin,
    staffRole,
    canManage,
    canEditPairings,
    canScore,
    canDrop,
    canViewDecklists,
    canDeleteEvent,
    canManageStaff,
  };
}

/** Permissions for anonymous / public spectators (pairings + standings view only). */
export function publicEventPermissions(): EventPermissions {
  return {
    isOwner: false,
    isAdmin: false,
    staffRole: null,
    canManage: false,
    canEditPairings: false,
    canScore: false,
    canDrop: false,
    canViewDecklists: false,
    canDeleteEvent: false,
    canManageStaff: false,
  };
}
