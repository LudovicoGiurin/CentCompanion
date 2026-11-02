import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db/index";
import { eventRegistrations, matches, users, type Event } from "../../db/schema";

export type RegistrationRow = typeof eventRegistrations.$inferSelect;

export const GUEST_PLACEHOLDER_HASH = "!guest-placeholder!";
export const GUEST_EMAIL_DOMAIN = "guest.centcomp.local";
export const COMPANION_IMPORT_HASH = "!companion-import!";
export const COMPANION_IMPORT_EMAIL_DOMAIN = "companion.import.local";

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();
}

export function formatPlayerName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "Unknown",
): string {
  const full = [firstName, lastName].map((p) => p?.trim()).filter(Boolean).join(" ");
  return full || fallback;
}

export function isGuestPlaceholderUser(user: { passwordHash: string; email?: string | null }) {
  return (
    user.passwordHash === GUEST_PLACEHOLDER_HASH ||
    (user.email?.endsWith(`@${GUEST_EMAIL_DOMAIN}`) ?? false)
  );
}

/** Synthetic users created for Companion import / unmatched pairings — not claimable profiles. */
export function isCompanionImportUser(user: {
  passwordHash: string;
  email?: string | null;
  username?: string | null;
}) {
  return (
    user.passwordHash === COMPANION_IMPORT_HASH ||
    (user.email?.endsWith(`@${COMPANION_IMPORT_EMAIL_DOMAIN}`) ?? false) ||
    (user.username?.startsWith("comp_") ?? false)
  );
}

/** Guest placeholders + Companion imports — skip for public profile / leaderboard claims. */
export function isSyntheticUser(user: {
  passwordHash: string;
  email?: string | null;
  username?: string | null;
}) {
  return isGuestPlaceholderUser(user) || isCompanionImportUser(user);
}

export async function loadEventRegistrations(eventId: number): Promise<RegistrationRow[]> {
  const db = getDb();
  return db
    .select()
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, eventId))
    .orderBy(asc(eventRegistrations.registeredAt));
}

export function countConfirmedSlots(regs: RegistrationRow[]) {
  const confirmedMembers = regs.filter((r) => !r.isGuest && r.registrationStatus === "confirmed").length;
  const confirmedGuests = regs.filter((r) => r.isGuest && r.registrationStatus === "confirmed").length;
  return { confirmedMembers, confirmedGuests, confirmedTotal: confirmedMembers + confirmedGuests };
}

/** Logged-in players fill slots first; guests only get confirmed spots left over. */
export function statusForNewMember(regs: RegistrationRow[], maxPlayers: number | null): "confirmed" | "waitlisted" {
  const max = maxPlayers ?? Number.POSITIVE_INFINITY;
  const { confirmedMembers, confirmedTotal } = countConfirmedSlots(regs);
  if (confirmedTotal < max) return "confirmed";
  if (confirmedMembers < max) return "confirmed";
  return "waitlisted";
}

export function statusForNewGuest(regs: RegistrationRow[], maxPlayers: number | null): "confirmed" | "waitlisted" {
  const max = maxPlayers ?? Number.POSITIVE_INFINITY;
  const { confirmedTotal } = countConfirmedSlots(regs);
  if (confirmedTotal < max) return "confirmed";
  return "waitlisted";
}

/** When a member joins and exceeds cap, bump the newest confirmed guest to waitlist. */
export async function makeRoomForMember(eventId: number, maxPlayers: number | null) {
  const max = maxPlayers ?? Number.POSITIVE_INFINITY;
  const regs = await loadEventRegistrations(eventId);
  const { confirmedMembers, confirmedTotal } = countConfirmedSlots(regs);
  if (confirmedTotal <= max || confirmedMembers <= max) return;

  const guestsToBump = confirmedTotal - max;
  const confirmedGuestRegs = regs
    .filter((r) => r.isGuest && r.registrationStatus === "confirmed")
    .sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime());

  const db = getDb();
  for (let i = 0; i < guestsToBump && i < confirmedGuestRegs.length; i += 1) {
    await db
      .update(eventRegistrations)
      .set({ registrationStatus: "waitlisted", updatedAt: new Date() })
      .where(eq(eventRegistrations.id, confirmedGuestRegs[i].id));
  }
}

/** When a confirmed player leaves, fill the slot from the waitlist (members first). */
export async function promoteFromWaitlist(eventId: number, maxPlayers: number | null) {
  const max = maxPlayers ?? Number.POSITIVE_INFINITY;
  const regs = await loadEventRegistrations(eventId);
  const { confirmedTotal } = countConfirmedSlots(regs);
  if (confirmedTotal >= max) return;

  const waitlisted = regs.filter((r) => r.registrationStatus === "waitlisted");
  const next = waitlisted.find((r) => !r.isGuest) ?? waitlisted.find((r) => r.isGuest) ?? null;
  if (!next) return;

  const db = getDb();
  await db
    .update(eventRegistrations)
    .set({ registrationStatus: "confirmed", updatedAt: new Date() })
    .where(eq(eventRegistrations.id, next.id));
}

/**
 * Native pairings / matches FK to users.id. Confirmed guests with null userId cannot be paired,
 * so create placeholder users and attach them before generating pairings.
 */
export async function ensureGuestPlayersForPairings(
  db: ReturnType<typeof getDb>,
  eventId: number,
): Promise<number> {
  const guests = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.registrationStatus, "confirmed"),
        eq(eventRegistrations.isGuest, true),
        isNull(eventRegistrations.userId),
      ),
    );

  let created = 0;
  for (const guest of guests) {
    const slug =
      `${guest.firstName}_${guest.lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40) || "player";
    const usernameBase = `guest_${eventId}_${slug}`.slice(0, 60);
    let username = usernameBase;
    let n = 0;
    while (true) {
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (!exists) break;
      n += 1;
      username = `${usernameBase}_${n}`.slice(0, 64);
    }

    const [placeholder] = await db
      .insert(users)
      .values({
        email: `${username}@${GUEST_EMAIL_DOMAIN}`,
        username,
        passwordHash: GUEST_PLACEHOLDER_HASH,
        firstName: guest.firstName,
        lastName: guest.lastName,
        emailVerified: false,
      })
      .returning();

    await db
      .update(eventRegistrations)
      .set({ userId: placeholder.id, updatedAt: new Date() })
      .where(eq(eventRegistrations.id, guest.id));

    created += 1;
  }
  return created;
}

export async function findClaimableGuestRegistration(
  eventId: number,
  firstName: string,
  lastName: string,
): Promise<RegistrationRow | null> {
  const db = getDb();
  const guests = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.isGuest, true),
        eq(eventRegistrations.registrationStatus, "confirmed"),
      ),
    );

  const matchesRows = guests.filter(
    (g) => namesMatch(g.firstName ?? "", firstName) && namesMatch(g.lastName ?? "", lastName),
  );
  if (matchesRows.length !== 1) return null;
  return matchesRows[0];
}

/** Transfer a guest (or guest-placeholder) registration to a real account; remap match FKs. */
export async function claimGuestRegistrationForUser(
  eventId: number,
  guest: RegistrationRow,
  authUser: { id: number; firstName: string; lastName: string },
): Promise<RegistrationRow> {
  const db = getDb();
  const placeholderId = guest.userId;

  if (placeholderId != null && placeholderId !== authUser.id) {
    await db
      .update(matches)
      .set({ player1Id: authUser.id, updatedAt: new Date() })
      .where(and(eq(matches.eventId, eventId), eq(matches.player1Id, placeholderId)));
    await db
      .update(matches)
      .set({ player2Id: authUser.id, updatedAt: new Date() })
      .where(and(eq(matches.eventId, eventId), eq(matches.player2Id, placeholderId)));
    await db
      .update(matches)
      .set({ reportedBy: authUser.id, updatedAt: new Date() })
      .where(and(eq(matches.eventId, eventId), eq(matches.reportedBy, placeholderId)));
  }

  const [reg] = await db
    .update(eventRegistrations)
    .set({
      userId: authUser.id,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      isGuest: false,
      registrationStatus: "confirmed",
      updatedAt: new Date(),
    })
    .where(eq(eventRegistrations.id, guest.id))
    .returning();

  if (placeholderId != null && placeholderId !== authUser.id) {
    const [ph] = await db.select().from(users).where(eq(users.id, placeholderId)).limit(1);
    if (ph && isGuestPlaceholderUser(ph)) {
      await db.delete(users).where(eq(users.id, placeholderId));
    }
  }

  return reg;
}

export function optionalMoxfieldSchema(zod: typeof import("zod").z) {
  return zod
    .string()
    .url()
    .refine((u) => u.includes("moxfield.com"), { message: "Must be a Moxfield deck URL" })
    .optional()
    .or(zod.literal(""))
    .transform((v) => (v?.trim() ? v.trim() : undefined));
}

export function registrationSummary(regs: RegistrationRow[], event: Event) {
  const { confirmedMembers, confirmedGuests, confirmedTotal } = countConfirmedSlots(regs);
  const waitlisted = regs.filter((r) => r.registrationStatus === "waitlisted").length;
  return {
    confirmedTotal,
    confirmedMembers,
    confirmedGuests,
    waitlisted,
    maxPlayers: event.maxPlayers,
  };
}
