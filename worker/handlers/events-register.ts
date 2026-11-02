import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/index";
import { eventRegistrations, events } from "../../db/schema";
import { error, getAuthUser, json, type RouteParams } from "../_shared/auth";
import {
  claimGuestRegistrationForUser,
  findClaimableGuestRegistration,
  formatPlayerName,
  loadEventRegistrations,
  makeRoomForMember,
  namesMatch,
  normalizeName,
  promoteFromWaitlist,
  registrationSummary,
  statusForNewGuest,
  statusForNewMember,
} from "../_shared/registrations";
import { requireTurnstile } from "../_shared/turnstile";
import { resolveEventPermissions } from "../_shared/event-permissions";
import { fetchMoxfieldDecklist, hashDecklist, parsePastedDecklist } from "../_shared/decklist";
import { getActivePhase } from "../_shared/phases";

const optionalMoxfield = z
  .union([
    z
      .string()
      .url()
      .refine((u) => u.includes("moxfield.com"), { message: "Must be a Moxfield deck URL" }),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null));

const registerSchema = z.object({
  moxfieldUrl: optionalMoxfield,
  deckName: z.string().max(255).optional(),
  decklistPaste: z.string().max(50_000).optional(),
  unlockDecklist: z.boolean().optional(),
});

const guestRegisterSchema = z.object({
  firstName: z.string().min(1).max(64),
  lastName: z.string().min(1).max(64),
  moxfieldUrl: optionalMoxfield,
  deckName: z.string().max(255).optional(),
  decklistPaste: z.string().max(50_000).optional(),
  turnstileToken: z.string().optional(),
  privacyAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Privacy Policy and Terms" }),
  }),
});

function mapRegistration(row: typeof eventRegistrations.$inferSelect, includeDecklist = false) {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    displayName: formatPlayerName(row.firstName, row.lastName),
    moxfieldUrl: row.moxfieldUrl,
    deckName: row.deckName,
    decklistSource: row.decklistSource,
    decklistLockedAt: row.decklistLockedAt,
    hasDecklist: Boolean(row.decklistJson),
    ...(includeDecklist ? { decklistJson: row.decklistJson } : {}),
    registrationStatus: row.registrationStatus,
    isGuest: row.isGuest,
    registeredAt: row.registeredAt,
  };
}

async function getEventOr404(eventId: number) {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  return event ?? null;
}

async function assertRegistrationOpen(
  event: typeof events.$inferSelect,
  opts?: { asOrganizer?: boolean },
) {
  if (event.status === "upcoming") {
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return error("Registration deadline passed", 400);
    }
    return null;
  }

  if (event.status === "ongoing" && event.opsMode === "native") {
    const phase = await getActivePhase(getDb(), event);
    if (phase?.kind === "top_cut") {
      return error("Registration closed — top cut has started", 400);
    }
    if (opts?.asOrganizer || event.allowLateEnrollment) {
      return null;
    }
    return error("Registration closed — event has started (late enrollment disabled)", 400);
  }

  return error("Registration closed — event has started", 400);
}

function decklistLocked(event: typeof events.$inferSelect, reg: typeof eventRegistrations.$inferSelect) {
  if (reg.decklistLockedAt) return true;
  if (event.decklistDeadline && new Date() > event.decklistDeadline) return true;
  if (event.status !== "upcoming" && !event.allowLateEnrollment) return true;
  return false;
}

async function resolveDecklistFields(body: {
  moxfieldUrl?: string | null;
  deckName?: string;
  decklistPaste?: string;
}) {
  let decklistJson: {
    main: { name: string; qty: number }[];
    commanders: { name: string; qty: number }[];
    hash?: string;
  } | null = null;
  let decklistSource: "moxfield" | "manual" | "paste" | null = null;
  let deckName = body.deckName ?? null;

  if (body.decklistPaste?.trim()) {
    decklistJson = parsePastedDecklist(body.decklistPaste);
    decklistJson.hash = await hashDecklist(decklistJson);
    decklistSource = "paste";
  } else if (body.moxfieldUrl) {
    const fetched = await fetchMoxfieldDecklist(body.moxfieldUrl);
    if (fetched) {
      decklistJson = fetched.decklist;
      decklistJson.hash = await hashDecklist(decklistJson);
      decklistSource = "moxfield";
      if (!deckName && fetched.name) deckName = fetched.name;
    }
  }

  return { decklistJson, decklistSource, deckName };
}

export async function handleEventsRegister(req: Request, params: RouteParams): Promise<Response> {
  const db = getDb();
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const event = await getEventOr404(eventId);
  if (!event) return error("Event not found", 404);

  const authUser = await getAuthUser(req);
  if (
    event.approvalStatus !== "approved" &&
    (!authUser || (authUser.role !== "admin" && authUser.id !== event.organizerId))
  ) {
    return error("Event not available", 404);
  }

  if (req.method === "GET") {
    const regs = await loadEventRegistrations(eventId);
    const claimable =
      authUser && !regs.some((r) => r.userId === authUser.id)
        ? await findClaimableGuestRegistration(eventId, authUser.firstName, authUser.lastName)
        : null;

    const perms = authUser ? await resolveEventPermissions(authUser, event) : null;
    const includeDecklists = Boolean(perms?.canViewDecklists);
    const isRegistered = Boolean(authUser && regs.some((r) => r.userId === authUser.id));
    const canSeeCompanionCode = Boolean(perms?.canViewDecklists || isRegistered);

    const { companionEventCode, ...eventPublic } = event;
    const eventPayload = {
      ...eventPublic,
      hasCompanionEventCode: Boolean(companionEventCode),
      companionEventCode: canSeeCompanionCode ? companionEventCode : null,
    };

    return json({
      event: eventPayload,
      registrations: regs.map((r) => mapRegistration(r, includeDecklists)),
      summary: registrationSummary(regs, event),
      claimableGuestRegistration: claimable ? mapRegistration(claimable) : null,
      permissions: perms,
    });
  }

  if (req.method === "POST") {
    if (!authUser) return error("Unauthorized", 401);
    const perms = await resolveEventPermissions(authUser, event);
    const closed = await assertRegistrationOpen(event, { asOrganizer: perms.canManage });
    if (closed) return closed;

    const body = registerSchema.safeParse(await req.json());
    if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

    const existing = await db
      .select()
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, authUser.id)));
    if (existing.length) return error("Already registered", 409);

    const claimable = await findClaimableGuestRegistration(eventId, authUser.firstName, authUser.lastName);
    if (claimable) {
      return error("You have a guest reservation for this event — use Claim reservation instead", 409);
    }

    const regs = await loadEventRegistrations(eventId);
    const status = statusForNewMember(regs, event.maxPlayers);
    const deck = await resolveDecklistFields(body.data);

    if (event.decklistRequired && !deck.decklistJson && !body.data.moxfieldUrl) {
      return error("A decklist is required for this event", 400);
    }

    const [reg] = await db
      .insert(eventRegistrations)
      .values({
        eventId,
        userId: authUser.id,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        moxfieldUrl: body.data.moxfieldUrl,
        deckName: deck.deckName ?? body.data.deckName,
        decklistJson: deck.decklistJson,
        decklistSource: deck.decklistSource,
        registrationStatus: status,
        isGuest: false,
      })
      .returning();

    if (status === "confirmed") {
      await makeRoomForMember(eventId, event.maxPlayers);
    }

    return json(
      {
        registration: mapRegistration(reg),
        companionEventCode: event.companionEventCode ?? null,
        message:
          status === "waitlisted"
            ? "You are on the waitlist. Logged-in players have priority for limited spots."
            : event.status === "ongoing"
              ? "Late registration confirmed — you'll be paired in the next round."
              : "Registered successfully!",
      },
      201,
    );
  }

  if (req.method === "PATCH") {
    if (!authUser) return error("Unauthorized", 401);

    const body = registerSchema.safeParse(await req.json());
    if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

    const perms = await resolveEventPermissions(authUser, event);
    const [existing] = await db
      .select()
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, authUser.id)))
      .limit(1);
    if (!existing) return error("Not registered for this event", 404);

    if (body.data.unlockDecklist) {
      if (!perms.canViewDecklists) return error("Forbidden", 403);
      const [reg] = await db
        .update(eventRegistrations)
        .set({ decklistLockedAt: null, updatedAt: new Date() })
        .where(eq(eventRegistrations.id, existing.id))
        .returning();
      return json({ registration: mapRegistration(reg, true) });
    }

    if (decklistLocked(event, existing) && !perms.canViewDecklists) {
      return error("Decklist changes are locked", 400);
    }

    const deck = await resolveDecklistFields(body.data);
    const [reg] = await db
      .update(eventRegistrations)
      .set({
        moxfieldUrl: body.data.moxfieldUrl,
        deckName: deck.deckName ?? body.data.deckName,
        ...(deck.decklistJson
          ? { decklistJson: deck.decklistJson, decklistSource: deck.decklistSource }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(eventRegistrations.id, existing.id))
      .returning();

    return json({ registration: mapRegistration(reg, perms.canViewDecklists) });
  }

  if (req.method === "DELETE") {
    if (!authUser) return error("Unauthorized", 401);

    if (event.status !== "upcoming") {
      return error("You can only leave before the event starts", 400);
    }

    const [existing] = await db
      .select()
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, authUser.id)))
      .limit(1);
    if (!existing) return error("Not registered for this event", 404);
    if (existing.registrationStatus === "dropped") {
      return error("You are already dropped from this event", 400);
    }

    const wasConfirmed = existing.registrationStatus === "confirmed";
    await db.delete(eventRegistrations).where(eq(eventRegistrations.id, existing.id));

    if (wasConfirmed) {
      await promoteFromWaitlist(eventId, event.maxPlayers);
    }

    return json({ message: "You left the event" });
  }

  return error("Method not allowed", 405);
}

export async function handleEventsGuestRegister(req: Request, params: RouteParams): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const db = getDb();
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const event = await getEventOr404(eventId);
  if (!event) return error("Event not found", 404);
  if (event.approvalStatus !== "approved") return error("Event not available", 404);
  if (!event.allowGuestRegistration) return error("Guest registration is not enabled for this event", 403);

  const closed = await assertRegistrationOpen(event);
  if (closed) return closed;

  const body = guestRegisterSchema.safeParse(await req.json());
  if (!body.success) return error(body.error.issues[0]?.message ?? "Invalid input");

  const captcha = await requireTurnstile(req, body.data.turnstileToken);
  if (captcha) return captcha;

  const firstName = normalizeName(body.data.firstName);
  const lastName = normalizeName(body.data.lastName);

  const existingGuest = await db
    .select()
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.isGuest, true)));

  const duplicate = existingGuest.find(
    (g) => namesMatch(g.firstName, firstName) && namesMatch(g.lastName, lastName),
  );
  if (duplicate) return error("A guest registration with this name already exists for this event", 409);

  const authUser = await getAuthUser(req);
  if (authUser && namesMatch(authUser.firstName, firstName) && namesMatch(authUser.lastName, lastName)) {
    return error("You have an account — please log in to register instead", 400);
  }

  const regs = await loadEventRegistrations(eventId);
  const status = statusForNewGuest(regs, event.maxPlayers);
  const deck = await resolveDecklistFields(body.data);

  if (event.decklistRequired && !deck.decklistJson && !body.data.moxfieldUrl) {
    return error("A decklist is required for this event", 400);
  }

  const [reg] = await db
    .insert(eventRegistrations)
    .values({
      eventId,
      userId: null,
      firstName,
      lastName,
      moxfieldUrl: body.data.moxfieldUrl,
      deckName: deck.deckName ?? body.data.deckName,
      decklistJson: deck.decklistJson,
      decklistSource: deck.decklistSource,
      registrationStatus: status,
      isGuest: true,
    })
    .returning();

  return json(
    {
      registration: mapRegistration(reg),
      companionEventCode: event.companionEventCode ?? null,
      message:
        status === "waitlisted"
          ? "You are on the waitlist. Create an account and claim this reservation to secure priority."
          : "Guest reservation confirmed! Create an account later to claim it for priority.",
    },
    201,
  );
}

export async function handleEventsClaimRegister(req: Request, params: RouteParams): Promise<Response> {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);

  const db = getDb();
  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");

  const event = await getEventOr404(eventId);
  if (!event) return error("Event not found", 404);

  const closed = await assertRegistrationOpen(event);
  if (closed) return closed;

  const existing = await db
    .select()
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, authUser.id)));
  if (existing.length) return error("Already registered for this event", 409);

  const guest = await findClaimableGuestRegistration(eventId, authUser.firstName, authUser.lastName);
  if (!guest) {
    return error("No matching guest reservation found for your name on this event", 404);
  }

  const reg = await claimGuestRegistrationForUser(eventId, guest, authUser);

  await makeRoomForMember(eventId, event.maxPlayers);

  return json({
    registration: mapRegistration(reg),
    companionEventCode: event.companionEventCode ?? null,
    message: "Guest reservation claimed — you're registered with account priority!",
  });
}

export async function handleEventsDecklistsExport(req: Request, params: RouteParams): Promise<Response> {
  if (req.method !== "GET") return error("Method not allowed", 405);
  const authUser = await getAuthUser(req);
  if (!authUser) return error("Unauthorized", 401);

  const eventId = Number(params.id);
  if (!eventId) return error("Invalid event id");
  const event = await getEventOr404(eventId);
  if (!event) return error("Event not found", 404);

  const perms = await resolveEventPermissions(authUser, event);
  if (!perms.canViewDecklists) return error("Forbidden", 403);

  const regs = await loadEventRegistrations(eventId);
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const rows = regs
    .filter((r) => r.registrationStatus === "confirmed" || r.registrationStatus === "dropped")
    .map((r) => ({
      player: formatPlayerName(r.firstName, r.lastName),
      deckName: r.deckName,
      moxfieldUrl: r.moxfieldUrl,
      source: r.decklistSource,
      decklist: r.decklistJson,
    }));

  if (format === "csv") {
    const lines = ["player,deckName,moxfieldUrl,commanders,mainCount"];
    for (const r of rows) {
      const commanders = (r.decklist?.commanders ?? []).map((c) => c.name).join("; ");
      const mainCount = (r.decklist?.main ?? []).reduce((a, c) => a + c.qty, 0);
      lines.push(
        `"${r.player.replace(/"/g, '""')}","${(r.deckName ?? "").replace(/"/g, '""')}","${r.moxfieldUrl ?? ""}","${commanders.replace(/"/g, '""')}",${mainCount}`,
      );
    }
    return new Response(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="event-${eventId}-decklists.csv"`,
      },
    });
  }

  return json({ eventId, decklists: rows });
}
