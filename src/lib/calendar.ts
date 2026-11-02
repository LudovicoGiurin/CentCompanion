import type { EventItem } from "./api";
import i18n from "../i18n";

function formatIcsDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildGoogleCalendarUrl(event: EventItem): string {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [
      event.description,
      event.format ? i18n.t("common:calendar.formatPrefix", { format: event.format }) : "",
    ]
      .filter(Boolean)
      .join("\n"),
    location: [event.location, event.city, event.storeName].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcsFile(event: EventItem): void {
  const start = formatIcsDate(event.startsAt);
  const end = formatIcsDate(new Date(new Date(event.startsAt).getTime() + 3 * 60 * 60 * 1000).toISOString());
  const uid = `centcomp-event-${event.id}@centcomp.net`;
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cent Companion//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `LOCATION:${escapeIcs([event.location, event.city, event.storeName].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${escapeIcs(event.description ?? i18n.t("common:calendar.defaultDescription"))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^\w\s-]/g, "").trim() || "event"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function mapsDirectionsUrl(location: string, city?: string | null): string {
  const q = [location, city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
