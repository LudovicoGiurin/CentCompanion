import { getEnv } from "../runtime";
import { error, json, type RouteParams } from "../_shared/auth";
import { appOrigin, eventShareDescription, eventShareImageVersion, getPublicEventShare } from "../_shared/events-public";
import { renderEventOgPng } from "../_shared/event-og-image";

export async function handleEventsShare(req: Request, params: RouteParams): Promise<Response> {
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const event = await getPublicEventShare(eventId);
  if (!event) return error("Event not found", 404);

  const url = new URL(req.url);
  const origin = appOrigin(getEnv().APP_URL, req.url);

  if (url.pathname.endsWith("/og.png")) {
    if (req.method !== "GET") return error("Method not allowed", 405);
    try {
      const png = await renderEventOgPng(event);
      return new Response(png, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      });
    } catch (err) {
      console.error("OG image render failed", err);
      return error("Failed to generate preview image", 500);
    }
  }

  if (req.method !== "GET") return error("Method not allowed", 405);

  return json({
    event: {
      id: event.id,
      title: event.title,
      description: eventShareDescription(event),
      storeName: event.storeName,
      city: event.city,
      location: event.location,
      eventType: event.eventType,
      startsAt: event.startsAt.toISOString(),
      format: event.format,
      status: event.status,
      joinCode: event.joinCode,
      registrationCount: event.registrationCount,
      maxPlayers: event.maxPlayers,
      organizerName: event.organizerName,
    },
    ogImageUrl: `${origin}/api/events/${event.id}/og.png?v=${encodeURIComponent(eventShareImageVersion(event))}`,
    pageUrl: `${origin}/events/${event.id}`,
  });
}
