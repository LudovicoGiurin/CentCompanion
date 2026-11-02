import type { Registration } from "./api";
import i18n from "../i18n";

export function waitlistPosition(registrations: Registration[], registrationId: number): number | null {
  const waitlisted = registrations
    .filter((r) => r.registrationStatus === "waitlisted")
    .sort((a, b) => {
      const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
      const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      return ta - tb;
    });
  const idx = waitlisted.findIndex((r) => r.id === registrationId);
  return idx >= 0 ? idx + 1 : null;
}

export function waitlistEmailNote(): string {
  return i18n.t("events:waitlist.emailNote");
}
