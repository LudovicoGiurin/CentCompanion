import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/index";
import { eventRegistrations, events, users } from "../../db/schema";

export type PublicEventShare = {
  id: number;
  title: string;
  storeName: string;
  location: string | null;
  city: string | null;
  eventType: "casual" | "local_league" | "lv1" | "lv2";
  startsAt: Date;
  format: string | null;
  status: string;
  joinCode: string;
  maxPlayers: number | null;
  registrationCount: number;
  organizerName: string | null;
};

export async function getPublicEventShare(eventId: number): Promise<PublicEventShare | null> {
  const db = getDb();

  const [row] = await db
    .select({
      id: events.id,
      title: events.title,
      storeName: events.storeName,
      location: events.location,
      city: events.city,
      eventType: events.eventType,
      startsAt: events.startsAt,
      format: events.format,
      status: events.status,
      joinCode: events.joinCode,
      maxPlayers: events.maxPlayers,
      approvalStatus: events.approvalStatus,
      organizerName: sql<string | null>`nullif(trim(concat(${users.firstName}, ' ', ${users.lastName})), '')`.as(
        "organizer_name",
      ),
      registrationCount: sql<number>`(
        select count(*)::int from ${eventRegistrations}
        where ${eventRegistrations.eventId} = ${events.id}
          and ${eventRegistrations.registrationStatus} = 'confirmed'
      )`.as("registration_count"),
    })
    .from(events)
    .leftJoin(users, eq(events.organizerId, users.id))
    .where(and(eq(events.id, eventId), eq(events.approvalStatus, "approved")))
    .limit(1);

  if (!row || row.status === "cancelled") return null;
  return {
    id: row.id,
    title: row.title,
    storeName: row.storeName,
    location: row.location,
    city: row.city,
    eventType: row.eventType,
    startsAt: row.startsAt,
    format: row.format,
    status: row.status,
    joinCode: row.joinCode,
    maxPlayers: row.maxPlayers,
    registrationCount: row.registrationCount,
    organizerName: row.organizerName,
  };
}

export function formatEventShareDate(startsAt: Date): string {
  return startsAt.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function eventStatusLabel(status: string): string {
  switch (status) {
    case "ongoing":
      return "Live";
    case "completed":
      return "Completed";
    default:
      return "Upcoming";
  }
}

export function eventTypeShareLabel(event: PublicEventShare): string {
  switch (event.eventType) {
    case "lv2":
      return "LV 2";
    case "lv1":
      return "LV 1";
    case "local_league":
      return event.city ? `LOCAL LEAGUE · ${event.city.toUpperCase()}` : "LOCAL LEAGUE";
    default:
      return "CASUAL";
  }
}

export function eventShareDescription(event: PublicEventShare): string {
  const place = [event.storeName, event.city ?? event.location].filter(Boolean).join(" · ");
  const when = formatEventShareDate(event.startsAt);
  const players = event.maxPlayers
    ? `${event.registrationCount}/${event.maxPlayers} players`
    : `${event.registrationCount} registered`;
  return [eventTypeShareLabel(event), place, when, players].filter(Boolean).join(" · ");
}

export function eventShareImageVersion(event: PublicEventShare): string {
  const capacity = event.maxPlayers ?? "x";
  const league = event.eventType === "local_league" ? event.city ?? "league" : event.eventType;
  return `${event.registrationCount}-${capacity}-${event.status}-${league}-v2`;
}

export function appOrigin(envAppUrl: string | undefined, requestUrl: string): string {
  const fromEnv = envAppUrl?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(requestUrl).origin;
}
