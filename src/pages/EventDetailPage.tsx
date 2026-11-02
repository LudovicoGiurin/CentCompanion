import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, formatUserName, type CompanionRegistrationOption, type CompanionStandingRow, type EventItem, type EventPermissions, type EventStaffMember, type MatchItem, type Registration, type RegistrationSummary, type RoundTimer, type TournamentStanding } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useGeo } from "../hooks/useGeo";
import { useToast } from "../hooks/useToast";
import { Page, TabPanel, Tabs } from "../components/Motion";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { Modal } from "../components/Modal";
import { SkeletonEventDetail } from "../components/Skeleton";
import { LocationSearch, resolveCityFromLocation } from "../components/LocationSearch";
import { isTurnstileEnabled, TurnstileWidget } from "../components/TurnstileWidget";
import { EventDetailHero, EventOverviewPanel, EventSignupGate, EventStickyCta, RegistrationChoiceCards } from "../components/EventDetailViews";
import { TournamentPanel } from "../components/TournamentPanel";
import { OrganizerConsole } from "../components/OrganizerConsole";
import { CompanionPullPanel } from "../components/CompanionPullPanel";
import { CompanionResultsReport } from "../components/CompanionResultsReport";
import { PrivacyConsentField } from "../components/PrivacyConsentField";
import { authReturnUrl, registerReturnUrl } from "../lib/authReturn";
import { isValidMoxfieldUrl, moxfieldHint } from "../lib/moxfield";
import { waitlistPosition } from "../lib/waitlist";
import { usePageMeta } from "../hooks/usePageMeta";
import { useIsPhone } from "../hooks/useIsPhone";
import { formatAppDate, formatAppDateTime } from "../lib/formatLocale";

function WaitlistNote({
  registration,
  registrations,
}: {
  registration: Registration;
  registrations: Registration[];
}) {
  const { t } = useTranslation("events");
  if (registration.registrationStatus !== "waitlisted") return null;
  const pos = waitlistPosition(registrations, registration.id);
  return (
    <p className="sc-body-sm cc-waitlist-note">
      {pos != null && <>{t("waitlist.position", { pos })} </>}
      {t("waitlist.emailNote")}
    </p>
  );
}

type DetailTab = "overview" | "register" | "tournament" | "manage";
type ConfirmAction = "cancel" | "start" | "endRound" | "resumeSwiss" | "complete" | null;
type RegMode = "choice" | "guest" | "decklist";

function guestRegKey(eventId: number) {
  return `cc_guest_reg_${eventId}`;
}

function guestCompanionCodeKey(eventId: number) {
  return `cc_guest_companion_code_${eventId}`;
}

function ManageSection({
  title,
  phone,
  children,
}: {
  title: string;
  phone: boolean;
  children: ReactNode;
}) {
  if (!phone) {
    return (
      <article className="sc-card">
        <h3 className="sc-headline-md">{title}</h3>
        {children}
      </article>
    );
  }
  return (
    <article className="sc-card">
      <details className="cc-organizer-phone-details">
        <summary className="cc-organizer-phone-details__summary">
          <span>{title}</span>
          <i className="ph ph-caret-down" aria-hidden />
        </summary>
        <div className="cc-organizer-phone-details__body">{children}</div>
      </details>
    </article>
  );
}

function loadStoredGuestReg(eventId: number): Registration | null {
  try {
    const raw = sessionStorage.getItem(guestRegKey(eventId));
    return raw ? (JSON.parse(raw) as Registration) : null;
  } catch {
    return null;
  }
}

function storeGuestReg(eventId: number, reg: Registration) {
  sessionStorage.setItem(guestRegKey(eventId), JSON.stringify(reg));
}

function loadStoredGuestCompanionCode(eventId: number): string | null {
  try {
    return sessionStorage.getItem(guestCompanionCodeKey(eventId));
  } catch {
    return null;
  }
}

function storeGuestCompanionCode(eventId: number, code: string | null | undefined) {
  if (code) sessionStorage.setItem(guestCompanionCodeKey(eventId), code);
  else sessionStorage.removeItem(guestCompanionCodeKey(eventId));
}

export function EventDetailPage() {
  const { t } = useTranslation("events");
  const { t: tc } = useTranslation("common");
  const { t: ta } = useTranslation("auth");
  const { id } = useParams();
  const eventId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const geo = useGeo();
  const { toast } = useToast();
  const isPhone = useIsPhone();
  const [searchParams, setSearchParams] = useSearchParams();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regSummary, setRegSummary] = useState<RegistrationSummary | null>(null);
  const [claimable, setClaimable] = useState<Registration | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [guestRegistration, setGuestRegistration] = useState<Registration | null>(null);
  const [regMode, setRegMode] = useState<RegMode>("choice");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestTurnstileToken, setGuestTurnstileToken] = useState("");
  const [guestPrivacyAccepted, setGuestPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moxfieldUrl, setMoxfieldUrl] = useState("");
  const [deckName, setDeckName] = useState("");
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [standings, setStandings] = useState<TournamentStanding[]>([]);
  const [rerollCount, setRerollCount] = useState(0);
  const [roundTimer, setRoundTimer] = useState<RoundTimer | null>(null);
  const [round, setRound] = useState(1);
  // While true, the viewed round follows the server's current round (initial
  // load + live polling). Cleared when the user picks a past round so a
  // refresh doesn't snap them back.
  const followCurrentRound = useRef(true);
  const [totalRounds, setTotalRounds] = useState(0);
  const [availableRounds, setAvailableRounds] = useState<number[]>([]);
  const [isOrganizerView, setIsOrganizerView] = useState(false);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStoreName, setEditStoreName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDerivedCity, setEditDerivedCity] = useState<string | null>(null);
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAllowGuest, setEditAllowGuest] = useState(true);
  const [editOpsMode, setEditOpsMode] = useState<"native" | "companion_linked">("native");
  const [editStructure, setEditStructure] = useState<"swiss" | "swiss_top_cut" | "single_elim">("swiss");
  const [editSwissRounds, setEditSwissRounds] = useState("");
  const [editTopCut, setEditTopCut] = useState<"8" | "4" | "2">("8");
  const [editLateEnroll, setEditLateEnroll] = useState(false);
  const [editCompanionCode, setEditCompanionCode] = useState("");
  const [editDecklistRequired, setEditDecklistRequired] = useState(false);
  const [staff, setStaff] = useState<EventStaffMember[]>([]);
  const [staffLogin, setStaffLogin] = useState("");
  const [staffRole, setStaffRole] = useState<"co_organizer" | "judge" | "scorekeeper">("judge");
  const [permissions, setPermissions] = useState<EventPermissions | null>(null);
  const [phaseKind, setPhaseKind] = useState<"swiss" | "top_cut">("swiss");
  const [decklistPaste, setDecklistPaste] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [moxfieldError, setMoxfieldError] = useState("");
  const [companionStandings, setCompanionStandings] = useState<CompanionStandingRow[]>([]);
  const [companionRegistrations, setCompanionRegistrations] = useState<CompanionRegistrationOption[]>([]);
  const [companionBusy, setCompanionBusy] = useState(false);
  const eventTabsRef = useRef<HTMLDivElement>(null);

  const eventReturnPath = useMemo(
    () => (eventId ? `/events/${eventId}?tab=register` : "/events"),
    [eventId],
  );

  const goToTab = useCallback(
    (tab: DetailTab) => {
      setActiveTab(tab);
      setSearchParams(tab === "overview" ? {} : { tab }, { replace: true });
      if (tab !== "overview" && window.matchMedia("(max-width: 640px)").matches) {
        requestAnimationFrame(() => {
          eventTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    [setSearchParams],
  );

  const openGuestForm = useCallback(() => {
    setRegMode("guest");
    goToTab("register");
    requestAnimationFrame(() => {
      document.getElementById("cc-guest-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [goToTab]);

  const canManageEvent =
    !!user &&
    !!event &&
    (user.role === "admin" ||
      event.organizerId === user.id ||
      Boolean(permissions?.canManage || permissions?.canEditPairings));
  const canEditDeck =
    event?.status === "upcoming" ||
    (event?.status === "ongoing" && (event.allowLateEnrollment || canManageEvent));
  const registrationOpen = Boolean(
    event &&
      (event.status === "upcoming" ||
        (event.status === "ongoing" && event.opsMode === "native" && event.allowLateEnrollment)) &&
      (!event.registrationDeadline || new Date(event.registrationDeadline) > new Date()),
  );
  const showSignupGate =
    isPhone &&
    !!event &&
    registrationOpen &&
    !registration &&
    !guestRegistration &&
    regMode === "choice";
  const showGuestSignup =
    isPhone &&
    !!event &&
    !user &&
    registrationOpen &&
    !registration &&
    !guestRegistration &&
    regMode === "guest";
  const showDecklistStep =
    isPhone &&
    !!event &&
    !!user &&
    registrationOpen &&
    !registration &&
    regMode === "decklist";
  /** Phone signup UI lives above the tabs — don't also show a Sign up tab */
  const phoneSignupOnTop =
    isPhone &&
    registrationOpen &&
    !registration &&
    !guestRegistration &&
    (regMode === "choice" || regMode === "guest" || regMode === "decklist");
  const scrollToSignup = useCallback(() => {
    if (phoneSignupOnTop) {
      setDetailsOpen(false);
      requestAnimationFrame(() => {
        const id =
          showDecklistStep ? "cc-decklist-form" : showGuestSignup ? "cc-guest-form" : "cc-signup-gate";
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    goToTab("register");
    requestAnimationFrame(() => {
      const id =
        showDecklistStep ? "cc-decklist-form" : showGuestSignup ? "cc-guest-form" : "cc-signup-gate";
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [goToTab, phoneSignupOnTop, showDecklistStep, showGuestSignup]);
  const showRegisterTab =
    (registrationOpen || !!registration || !!guestRegistration) && !phoneSignupOnTop;
  const confirmedTotalCount = regSummary?.confirmedTotal ?? registrations.filter((r) => r.registrationStatus === "confirmed").length;
  const showTournament =
    event &&
    (event.status === "ongoing" ||
      event.status === "completed" ||
      matches.length > 0 ||
      companionStandings.length > 0 ||
      event.opsMode === "companion_linked");
  const isCompanionLinked = event?.opsMode === "companion_linked";

  const defaultTab = useMemo((): DetailTab => {
    const param = searchParams.get("tab") as DetailTab | null;
    if (param === "manage" && canManageEvent) return "manage";
    if (param === "tournament" && showTournament) return "tournament";
    if (param === "register" && showRegisterTab) return "register";
    if (param === "overview") return "overview";
    // Phone: signup is above the fold — land on Info. Desktop: register when logged out.
    if (phoneSignupOnTop) return "overview";
    if (!user && registrationOpen) return "register";
    return "overview";
  }, [searchParams, canManageEvent, showTournament, showRegisterTab, user, registrationOpen, phoneSignupOnTop]);

  const [activeTab, setActiveTab] = useState<DetailTab>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (activeTab === "register" && !showRegisterTab) {
      setActiveTab("overview");
    }
  }, [activeTab, showRegisterTab]);

  useEffect(() => {
    if (defaultTab === "overview" || loading) return;
    if (!window.matchMedia("(max-width: 640px)").matches) return;
    const t = window.setTimeout(() => {
      eventTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [defaultTab, loading, eventId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getEvent(eventId);
      setRegistrations(data.registrations);
      setRegSummary(data.summary);
      setClaimable(data.claimableGuestRegistration);
      setPermissions(data.permissions ?? null);
      const mine = data.registrations.find((r) => r.userId === user?.id);
      setRegistration(mine ?? null);
      const storedGuest = loadStoredGuestReg(eventId);
      const guestFromList =
        storedGuest && data.registrations.some((r) => r.id === storedGuest.id) ? storedGuest : null;
      setGuestRegistration(guestFromList);
      if (!guestFromList) {
        storeGuestCompanionCode(eventId, null);
      } else if (!data.event.companionEventCode) {
        const storedCode = loadStoredGuestCompanionCode(eventId);
        if (storedCode) {
          data.event.companionEventCode = storedCode;
          data.event.hasCompanionEventCode = true;
        }
      }
      setEvent(data.event);
      setEditTitle(data.event.title);
      setEditStoreName(data.event.storeName);
      setEditLocation(data.event.location ?? "");
      setEditDerivedCity(data.event.city ?? null);
      setEditStartsAt(data.event.startsAt.slice(0, 16));
      setEditDescription(data.event.description ?? "");
      setEditAllowGuest(data.event.allowGuestRegistration ?? true);
      setEditOpsMode(data.event.opsMode ?? "native");
      setEditStructure(data.event.tournamentStructure ?? "swiss");
      setEditSwissRounds(data.event.swissRounds != null ? String(data.event.swissRounds) : "");
      setEditTopCut(String(data.event.topCutSize ?? 8) as "8" | "4" | "2");
      setEditLateEnroll(data.event.allowLateEnrollment ?? false);
      setEditCompanionCode(data.event.companionEventCode ?? "");
      setEditDecklistRequired(data.event.decklistRequired ?? false);
      if (mine) {
        setMoxfieldUrl(mine.moxfieldUrl ?? "");
        setDeckName(mine.deckName ?? "");
      }
    } catch {
      toast(t("detail.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const loadPairings = useCallback(async (targetRound?: number) => {
    try {
      const data = await api.getPairings(eventId, targetRound ?? round);
      setMatches(data.matches);
      setStandings(data.standings);
      setRerollCount(data.meta?.rerollCount ?? 0);
      setRoundTimer(data.timer ?? null);
      setEvent(data.event);
      setTotalRounds(data.totalRounds);
      setAvailableRounds(data.availableRounds);
      setIsOrganizerView(data.isOrganizer);
      setPermissions(data.permissions ?? null);
      setPhaseKind(data.phaseKind ?? data.activePhase?.kind ?? "swiss");
      if (followCurrentRound.current) {
        setRound(data.event.currentRound ?? targetRound ?? round);
      }
    } catch {
      /* pairings may not exist yet */
    }
  }, [eventId, round]);

  const loadCompanionResults = useCallback(async () => {
    try {
      const data = await api.getCompanionResults(eventId);
      setCompanionStandings(data.standings);
      setCompanionRegistrations(data.registrations);
    } catch {
      /* no companion results yet */
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !event) return;
    if (event.opsMode === "companion_linked" || event.companionLastPulledAt) {
      void loadCompanionResults();
    }
  }, [eventId, event?.opsMode, event?.companionLastPulledAt, loadCompanionResults]);

  useEffect(() => {
    if (!canManageEvent || !eventId) return;
    void api
      .getEventStaff(eventId)
      .then((d) => setStaff(d.staff))
      .catch(() => undefined);
  }, [canManageEvent, eventId]);

  useEffect(() => {
    if (eventId) load();
  }, [eventId, user?.id]);

  useEffect(() => {
    if (event?.status === "ongoing" || event?.status === "completed") loadPairings();
  }, [event?.status, round, eventId, loadPairings]);

  useEffect(() => {
    if (event?.status !== "ongoing" || activeTab !== "tournament") return;
    const timer = window.setInterval(() => {
      void loadPairings(round);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [event?.status, activeTab, round, loadPairings]);

  const myMatch = user
    ? matches.find((m) => m.player1Id === user.id || m.player2Id === user.id)
    : undefined;

  const pendingCount = matches.filter((m) => m.result === "pending").length;
  const currentRound = event?.currentRound ?? round;
  const isLiveRound = round === currentRound && event?.status === "ongoing";

  const handleRoundChange = (r: number) => {
    followCurrentRound.current = r >= currentRound;
    setRound(r);
  };

  usePageMeta(
    event
      ? {
          title: `${event.title} — Cent Companion`,
          description: `${event.storeName}${event.city ? ` · ${event.city}` : ""} — ${formatAppDateTime(event.startsAt)}`,
          ogTitle: event.title,
          ogDescription: `${event.storeName} · ${formatAppDate(event.startsAt)}`,
          ogUrl: `https://centcomp.net/events/${event.id}`,
          ogImage: `${typeof window !== "undefined" ? window.location.origin : "https://centcomp.net"}/api/events/${event.id}/og.png?v=${encodeURIComponent(`${confirmedTotalCount}-${event.maxPlayers ?? "x"}-${event.status}`)}`,
        }
      : {},
  );

  const stickyMatchLabel =
    event?.status === "ongoing" && myMatch
      ? t("live.yourTableRound", { n: currentRound })
      : event?.status === "ongoing" && showTournament
        ? t("live.roundN", { n: currentRound })
        : null;

  const tabs = useMemo(() => {
    const items: { id: DetailTab; label: string; icon?: string }[] = [
      { id: "overview", label: isPhone ? t("detail.tabs.info") : t("detail.tabs.overview"), icon: "ph-info" },
    ];
    if (showRegisterTab) {
      items.push({
        id: "register",
        label: registration || guestRegistration
          ? isPhone
            ? t("detail.tabs.yourSpot")
            : t("detail.tabs.registration")
          : isPhone
            ? t("detail.tabs.signUp")
            : t("detail.tabs.register"),
        icon: "ph-cards",
      });
    }
    if (showTournament) {
      items.push({
        id: "tournament",
        label: isPhone ? t("detail.tabs.live") : t("detail.tabs.tournament"),
        icon: "ph-trophy",
      });
    }
    if (canManageEvent) {
      items.push({ id: "manage", label: t("detail.tabs.manage"), icon: "ph-gear" });
    }
    return items;
  }, [isPhone, showRegisterTab, registration, guestRegistration, showTournament, canManageEvent, t]);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    await submitRegistration();
  };

  const openDecklistStep = useCallback(() => {
    setRegMode("decklist");
    setMoxfieldError("");
    if (isPhone) {
      setDetailsOpen(false);
      requestAnimationFrame(() => {
        document.getElementById("cc-decklist-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    goToTab("register");
  }, [goToTab, isPhone]);

  const canLeaveEvent =
    !!user &&
    !!registration &&
    registration.registrationStatus !== "dropped" &&
    event?.status === "upcoming";

  const handleLeaveEvent = async () => {
    setLeaveBusy(true);
    try {
      await api.leaveEvent(eventId);
      setRegistration(null);
      setMoxfieldUrl("");
      setDeckName("");
      setDecklistPaste("");
      setLeaveConfirmOpen(false);
      toast(t("toasts.left"), "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.leaveFailed"), "error");
    } finally {
      setLeaveBusy(false);
    }
  };

  const submitRegistration = async (opts?: { skipDeck?: boolean }) => {
    if (opts?.skipDeck && event?.decklistRequired) {
      openDecklistStep();
      return;
    }
    setMoxfieldError("");
    const url = opts?.skipDeck ? "" : moxfieldUrl.trim();
    const name = opts?.skipDeck ? "" : deckName.trim();
    const paste = opts?.skipDeck ? "" : decklistPaste.trim();
    if (event?.decklistRequired && !opts?.skipDeck && !url && !paste) {
      setMoxfieldError(t("errors.deckRequired"));
      return;
    }
    if (url && !isValidMoxfieldUrl(url)) {
      setMoxfieldError(t("errors.moxfieldInvalid"));
      return;
    }
    setRegisterBusy(true);
    try {
      const body = {
        moxfieldUrl: url || undefined,
        deckName: name || undefined,
        decklistPaste: paste || undefined,
      };
      if (registration) {
        const data = await api.updateDecklist(eventId, body);
        setRegistration(data.registration);
        toast(t("toasts.deckUpdated"), "success");
      } else {
        const data = await api.registerEvent(eventId, body);
        setRegistration(data.registration);
        setRegistrations((prev) => [...prev, data.registration]);
        setRegMode("choice");
        toast(data.message ?? t("toasts.registered"), data.registration.registrationStatus === "waitlisted" ? "info" : "success");
        await load();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.registrationFailed"), "error");
    } finally {
      setRegisterBusy(false);
    }
  };

  const beginMemberRegister = () => {
    if (event?.decklistRequired) {
      openDecklistStep();
      return;
    }
    void submitRegistration({ skipDeck: true });
  };

  const onGuestTurnstileToken = useCallback((token: string) => setGuestTurnstileToken(token), []);

  const handleGuestRegister = async (e: FormEvent) => {
    e.preventDefault();
    setMoxfieldError("");
    if (isTurnstileEnabled() && !guestTurnstileToken) {
      toast(tc("securityCheck.label"), "error");
      return;
    }
    if (!guestPrivacyAccepted) {
      toast(ta("register.acceptPrivacy"), "error");
      return;
    }
    if (event?.decklistRequired && !moxfieldUrl.trim() && !decklistPaste.trim()) {
      setMoxfieldError(t("errors.deckRequired"));
      return;
    }
    if (moxfieldUrl.trim() && !isValidMoxfieldUrl(moxfieldUrl)) {
      setMoxfieldError(t("errors.moxfieldInvalid"));
      return;
    }
    setGuestBusy(true);
    try {
      const data = await api.registerGuestEvent(eventId, {
        firstName: guestFirstName,
        lastName: guestLastName,
        moxfieldUrl: moxfieldUrl.trim() || undefined,
        deckName: deckName.trim() || undefined,
        decklistPaste: decklistPaste.trim() || undefined,
        turnstileToken: guestTurnstileToken || undefined,
        privacyAccepted: true,
      });
      setGuestRegistration(data.registration);
      storeGuestReg(eventId, data.registration);
      storeGuestCompanionCode(eventId, data.companionEventCode);
      if (data.companionEventCode) {
        setEvent((prev) =>
          prev
            ? {
                ...prev,
                companionEventCode: data.companionEventCode,
                hasCompanionEventCode: true,
              }
            : prev,
        );
      }
      setRegistrations((prev) => [...prev, data.registration]);
      setRegMode("choice");
      toast(data.message ?? t("toasts.guestSaved"), data.registration.registrationStatus === "waitlisted" ? "info" : "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.registrationFailed"), "error");
      setGuestTurnstileToken("");
    } finally {
      setGuestBusy(false);
    }
  };

  const handleClaimRegistration = async () => {
    try {
      const data = await api.claimEventRegistration(eventId);
      setRegistration(data.registration);
      setClaimable(null);
      setGuestRegistration(null);
      sessionStorage.removeItem(guestRegKey(eventId));
      storeGuestCompanionCode(eventId, null);
      toast(data.message ?? t("toasts.claimed"), "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.claimFailed"), "error");
    }
  };

  const handleSaveEvent = async (e: FormEvent) => {
    e.preventDefault();
    try {
      let city = editDerivedCity;
      if (event?.eventType === "local_league" && !city && editLocation.trim()) {
        city = await resolveCityFromLocation(editLocation, geo);
      }
      await api.updateEvent(eventId, {
        title: editTitle,
        storeName: editStoreName,
        location: editLocation,
        city: city ?? undefined,
        startsAt: editStartsAt,
        description: editDescription,
        allowGuestRegistration: editAllowGuest,
        ...(event?.status === "upcoming"
          ? {
              opsMode: editOpsMode,
              tournamentStructure: editStructure,
            }
          : {}),
        swissRounds: editSwissRounds ? Number(editSwissRounds) : null,
        topCutSize:
          (event?.status === "upcoming" ? editStructure : event?.tournamentStructure) === "swiss_top_cut"
            ? (Number(editTopCut) as 2 | 4 | 8)
            : null,
        allowLateEnrollment: editLateEnroll,
        companionEventCode: editCompanionCode.trim() || null,
        decklistRequired: editDecklistRequired,
      });
      await load();
      if (event?.status === "ongoing" || event?.status === "completed") {
        await loadPairings(round);
      }
      toast(t("toasts.updated"), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.updateFailed"), "error");
    }
  };

  const copyEventLink = async () => {
    if (!event) return;
    const baseUrl = `${window.location.origin}/events/${event.id}`;
    const shareVersion = `${confirmedTotalCount}-${event.maxPlayers ?? "x"}-${event.status}`;
    const shareUrl = `${baseUrl}?share=${encodeURIComponent(shareVersion)}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch {
      // Ignore clipboard errors and continue with native share.
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: `${event.storeName}${event.city ? ` · ${event.city}` : ""}`,
          url: shareUrl,
        });
      }
    } catch {
      // Ignore cancellation/errors; link is already copied when possible.
    }
    if (!copied) {
      await navigator.clipboard.writeText(shareUrl);
    }
    toast(t("toasts.linkCopied"), "success");
  };

  const copyJoinCode = () => {
    if (!event?.joinCode) return;
    void navigator.clipboard.writeText(event.joinCode);
    toast(t("toasts.codeCopied"), "success");
  };

  const updateMatchResult = async (
    matchId: number,
    data: { result?: string; p1Games?: number; p2Games?: number },
  ) => {
    try {
      const res = await api.updateMatch(eventId, matchId, data);
      const updated = res.match as Pick<MatchItem, "result" | "p1Games" | "p2Games" | "updatedAt">;
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                result: updated.result,
                p1Games: updated.p1Games,
                p2Games: updated.p2Games,
                updatedAt: updated.updatedAt,
              }
            : m,
        ),
      );
      void api.getPairings(eventId, round).then((fresh) => {
        setStandings(fresh.standings);
      }).catch(() => undefined);
      toast(t("toasts.resultUpdated"), "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.resultFailed"), "error");
      throw err;
    }
  };

  const handleDropPlayer = async (registrationId: number) => {
    await api.dropPlayer(eventId, registrationId);
    await load();
    await loadPairings(round);
    toast(t("toasts.playerDropped"), "success");
  };

  const handleSaveManualPairings = async (
    pairings: { tableNumber: number; player1Id: number; player2Id: number | null }[],
  ) => {
    try {
      const result = await api.saveManualPairings(eventId, round, pairings);
      await loadPairings(round);
      if (result.warnings.length) {
        toast(`Pairings saved — ${result.warnings.join("; ")}`, "info");
      } else {
        toast(t("toasts.pairingsSaved"), "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.pairingsFailed"), "error");
      throw err;
    }
  };

  const handleSetRoundTimer = async (remainingSec: number, running: boolean) => {
    try {
      const result = await api.setRoundTimer(eventId, { round, remainingSec, running });
      setRoundTimer(result.timer);
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.timerFailed"), "error");
      throw err;
    }
  };

  const runConfirmAction = async () => {
    setPairingBusy(true);
    try {
      if (confirmAction === "cancel") {
        await api.cancelEvent(eventId);
        await load();
        toast(t("toasts.cancelled"), "success");
      } else if (confirmAction === "start") {
        await api.startEvent(eventId);
        await load();
        followCurrentRound.current = true;
        await loadPairings(1);
        goToTab("tournament");
        toast(t("toasts.started"), "success");
      } else if (confirmAction === "endRound") {
        const result = await api.endRound(eventId);
        await load();
        followCurrentRound.current = true;
        await loadPairings(result.round ?? round + 1);
        toast(
          result.topCut
            ? t("toasts.swissTopCut")
            : result.completed
              ? t("toasts.completedBang")
              : result.message,
          "success",
        );
      } else if (confirmAction === "resumeSwiss") {
        const result = await api.resumeSwiss(eventId);
        await load();
        followCurrentRound.current = true;
        await loadPairings(result.round ?? 2);
        toast(t("toasts.resumedSwiss"), "success");
      } else if (confirmAction === "complete") {
        await api.completeEvent(eventId);
        await load();
        await loadPairings(round);
        toast(t("toasts.completed"), "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t("toasts.actionFailed"), "error");
    } finally {
      setPairingBusy(false);
      setConfirmAction(null);
    }
  };

  const confirmCopy = {
    cancel: { title: t("confirm.cancel.title"), body: t("confirm.cancel.body"), label: t("confirm.cancel.label"), variant: "danger" as const },
    start: { title: t("confirm.start.title"), body: t("confirm.start.body"), label: t("confirm.start.label"), variant: "primary" as const },
    endRound: { title: t("confirm.endRound.title", { n: round }), body: t("confirm.endRound.body", { next: round + 1 }), label: t("confirm.endRound.label"), variant: "primary" as const },
    resumeSwiss: { title: t("confirm.resumeSwiss.title"), body: t("confirm.resumeSwiss.body"), label: t("confirm.resumeSwiss.label"), variant: "primary" as const },
    complete: { title: t("confirm.complete.title"), body: t("confirm.complete.body"), label: t("confirm.complete.label"), variant: "primary" as const },
  };

  return (
    <Page className="cc-event-detail">
      <section className="cc-section cc-event-page">
        <div className="sc-container">
          <Breadcrumbs
            items={[
              { label: tc("nav.events"), to: "/events" },
              { label: event?.title ?? tc("nav.events") },
              ...(showTournament && activeTab === "tournament" ? [{ label: t("live.roundN", { n: round }) }] : []),
            ]}
          />

          {loading ? (
            <SkeletonEventDetail />
          ) : event ? (
            <>
              {showSignupGate && (
                <EventSignupGate
                  event={event}
                  summary={regSummary}
                  allowGuest={!!event.allowGuestRegistration}
                  onLogin={() => navigate(authReturnUrl(eventReturnPath))}
                  onGuest={openGuestForm}
                  onCreateAccount={() => navigate(registerReturnUrl(eventReturnPath))}
                  member={
                    user
                      ? {
                          name: formatUserName(user),
                          busy: registerBusy,
                          decklistRequired: !!event.decklistRequired,
                          onRegister: beginMemberRegister,
                          claimable: claimable
                            ? { onClaim: () => void handleClaimRegistration() }
                            : null,
                        }
                      : null
                  }
                />
              )}

              {showDecklistStep && user && (
                <article className="sc-card cc-reg-easy" id="cc-decklist-form">
                  <form className="cc-form" onSubmit={handleRegister}>
                    <h3 className="sc-headline-md">{t("reg.decklist.title")}</h3>
                    <p className="sc-body-sm cc-reg-easy__lede">
                      {t("reg.decklist.lede", { name: formatUserName(user) })}
                    </p>
                    {moxfieldError && <div className="cc-alert cc-alert--error">{moxfieldError}</div>}
                    <label className="sc-field">
                      <span className="sc-field__label">{t("reg.moxfield")}</span>
                      <span className="sc-field__hint">{moxfieldHint()}</span>
                      <input
                        className="sc-input"
                        type="url"
                        placeholder={t("reg.moxfieldPlaceholder")}
                        value={moxfieldUrl}
                        onChange={(e) => setMoxfieldUrl(e.target.value)}
                        disabled={registerBusy}
                        required={!decklistPaste.trim()}
                        autoFocus
                      />
                    </label>
                    <label className="sc-field">
                      <span className="sc-field__label">{t("reg.deckName")}</span>
                      <input className="sc-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={registerBusy} />
                    </label>
                    <label className="sc-field">
                      <span className="sc-field__label">{t("reg.paste")}</span>
                      <span className="sc-field__hint">{t("reg.pasteHint")}</span>
                      <textarea
                        className="sc-input"
                        rows={4}
                        value={decklistPaste}
                        onChange={(e) => setDecklistPaste(e.target.value)}
                        disabled={registerBusy}
                      />
                    </label>
                    <button className="sc-btn sc-btn--lg cc-reg-easy__cta" type="submit" disabled={registerBusy}>
                      {registerBusy ? t("signup.registering") : t("reg.complete")}
                    </button>
                    <button className="sc-btn sc-btn--ghost" type="button" onClick={() => setRegMode("choice")} disabled={registerBusy}>{tc("actions.back")}</button>
                  </form>
                </article>
              )}

              {showGuestSignup && (
                <article className="sc-card cc-reg-easy" id="cc-guest-form">
                  <form className="cc-form" onSubmit={handleGuestRegister}>
                    <h3 className="sc-headline-md">{t("reg.guest.title")}</h3>
                    <p className="sc-body-sm cc-reg-easy__lede">
                      {event.decklistRequired
                        ? t("reg.guest.ledeRequired")
                        : t("reg.guest.ledeOptional")}
                    </p>
                    {moxfieldError && <div className="cc-alert cc-alert--error">{moxfieldError}</div>}
                    <div className="cc-grid-2">
                      <label className="sc-field">
                        <span className="sc-field__label">{ta("register.firstName")}</span>
                        <input className="sc-input" value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} required disabled={guestBusy} autoComplete="given-name" />
                      </label>
                      <label className="sc-field">
                        <span className="sc-field__label">{ta("register.lastName")}</span>
                        <input className="sc-input" value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} required disabled={guestBusy} autoComplete="family-name" />
                      </label>
                    </div>
                    <PrivacyConsentField
                      id="guest-privacy-consent"
                      checked={guestPrivacyAccepted}
                      onChange={setGuestPrivacyAccepted}
                    />
                    <TurnstileWidget onToken={onGuestTurnstileToken} />
                    {event.decklistRequired ? (
                      <>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("reg.moxfield")}</span>
                          <span className="sc-field__hint">{moxfieldHint()}</span>
                          <input
                            className="sc-input"
                            type="url"
                            placeholder={t("reg.moxfieldPlaceholder")}
                            value={moxfieldUrl}
                            onChange={(e) => setMoxfieldUrl(e.target.value)}
                            disabled={guestBusy}
                            required={!decklistPaste.trim()}
                          />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("reg.deckName")}</span>
                          <input className="sc-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={guestBusy} />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("reg.paste")}</span>
                          <textarea
                            className="sc-input"
                            rows={4}
                            value={decklistPaste}
                            onChange={(e) => setDecklistPaste(e.target.value)}
                            disabled={guestBusy}
                          />
                        </label>
                      </>
                    ) : (
                      <details className="cc-reg-easy__optional">
                        <summary>{t("reg.guest.optionalDeck")}</summary>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("reg.moxfield")}</span>
                          <span className="sc-field__hint">{moxfieldHint()}</span>
                          <input
                            className="sc-input"
                            type="url"
                            placeholder={t("reg.moxfieldPlaceholder")}
                            value={moxfieldUrl}
                            onChange={(e) => setMoxfieldUrl(e.target.value)}
                            disabled={guestBusy}
                          />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("reg.deckName")}</span>
                          <input className="sc-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={guestBusy} />
                        </label>
                      </details>
                    )}
                    <button className="sc-btn sc-btn--lg cc-reg-easy__cta" type="submit" disabled={!guestPrivacyAccepted || guestBusy}>
                      {guestBusy ? t("reg.guest.saving") : t("reg.guest.reserve")}
                    </button>
                    <button className="sc-btn sc-btn--ghost" type="button" onClick={() => setRegMode("choice")}>{tc("actions.back")}</button>
                  </form>
                </article>
              )}

              {(showSignupGate || showGuestSignup || showDecklistStep) && !detailsOpen && (
                <div className="cc-signup-gate__more">
                  <button type="button" className="sc-btn sc-btn--ghost sc-btn--sm" onClick={() => setDetailsOpen(true)}>
                    {t("reg.details")}
                  </button>
                </div>
              )}

              {(showSignupGate || showGuestSignup || showDecklistStep) && detailsOpen && (
                <div className="cc-signup-gate__more">
                  <button type="button" className="sc-btn sc-btn--ghost sc-btn--sm" onClick={() => setDetailsOpen(false)}>
                    {t("reg.hideDetails")}
                  </button>
                </div>
              )}

              {(!showSignupGate && !showGuestSignup && !showDecklistStep) || detailsOpen ? (
                <>
              {!(showSignupGate || showGuestSignup || showDecklistStep) && (
                <EventDetailHero
                  event={event}
                  summary={regSummary}
                  registrationOpen={registrationOpen}
                  isRegistered={!!registration || !!guestRegistration}
                  onRegister={scrollToSignup}
                  onTournament={() => goToTab("tournament")}
                  onManage={() => goToTab("manage")}
                  canManage={canManageEvent}
                  showTournament={!!showTournament}
                  onCopyLink={copyEventLink}
                />
              )}

              {myMatch && event.status === "ongoing" && activeTab !== "tournament" && (
                <div className="cc-tournament__my-table cc-tournament__my-table--banner">
                  <span className="cc-tournament__my-table-label">{t("live.banner")}</span>
                  <strong>{t("live.table", { n: myMatch.tableNumber ?? "—" })}</strong>
                  <span>{t("live.vs", { name: myMatch.player1Id === user?.id ? myMatch.player2 : myMatch.player1 })}</span>
                  <button className="sc-btn sc-btn--sm" type="button" onClick={() => goToTab("tournament")}>
                    {t("live.viewPairings")}
                  </button>
                </div>
              )}

              <div ref={eventTabsRef} className="cc-event-tabs-anchor">
              <Tabs tabs={tabs} active={activeTab} onChange={goToTab} ariaLabel={t("detail.tabs.aria")} className="cc-event-tabs" />

              <TabPanel id="overview" active={activeTab === "overview"}>
                <EventOverviewPanel
                  event={event}
                  registrations={registrations}
                  summary={regSummary}
                  registrationOpen={registrationOpen}
                  registration={registration}
                  guestRegistration={guestRegistration}
                  canManage={canManageEvent}
                  onRegister={scrollToSignup}
                  onLeave={canLeaveEvent ? () => setLeaveConfirmOpen(true) : undefined}
                  skipSummaryFacts={showSignupGate || showGuestSignup || showDecklistStep}
                />
              </TabPanel>

              <TabPanel id="register" active={activeTab === "register"}>
                {guestRegistration && !registration ? (
                  <article className="sc-card">
                    <h3 className="sc-headline-md">{t("reg.guest.title")}</h3>
                    <p>
                      {guestRegistration.displayName} —{" "}
                      <span className={`sc-chip ${guestRegistration.registrationStatus === "confirmed" ? "sc-chip--primary" : "sc-chip--gold"}`}>
                        {guestRegistration.registrationStatus === "confirmed" ? t("overview.reg.confirmed") : t("overview.reg.waitlisted")}
                      </span>
                    </p>
                    {guestRegistration.registrationStatus === "waitlisted" && (
                      <WaitlistNote registration={guestRegistration} registrations={registrations} />
                    )}
                    {guestRegistration.moxfieldUrl && (
                      <p className="sc-body-sm">
                        <a href={guestRegistration.moxfieldUrl} target="_blank" rel="noreferrer">{t("reg.viewMoxfield")}</a>
                      </p>
                    )}
                    <div className="sc-row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <Link to={authReturnUrl(eventReturnPath)} className="sc-btn sc-btn--secondary sc-btn--sm">{t("reg.logInToClaim")}</Link>
                      <Link to={registerReturnUrl(eventReturnPath)} className="sc-btn sc-btn--ghost sc-btn--sm">{t("signup.createAccount")}</Link>
                    </div>
                  </article>
                ) : registration ? (
                  user && canEditDeck ? (
                    <article className="sc-card cc-reg-easy">
                      <div className="cc-reg-easy__status">
                        <h3 className="sc-headline-md">
                          {registration.registrationStatus === "waitlisted" ? t("overview.youreWaitlisted") : t("overview.youreRegistered")}
                        </h3>
                        <span className={`sc-chip ${registration.registrationStatus === "confirmed" ? "sc-chip--primary" : "sc-chip--gold"}`}>
                          {registration.registrationStatus}
                        </span>
                      </div>
                      {registration.registrationStatus === "waitlisted" && (
                        <WaitlistNote registration={registration} registrations={registrations} />
                      )}
                      {moxfieldError && <div className="cc-alert cc-alert--error">{moxfieldError}</div>}
                      <form className="cc-form" onSubmit={handleRegister}>
                        <details className="cc-reg-easy__optional">
                          <summary>{t("reg.updateDeckOptional")}</summary>
                          <label className="sc-field">
                            <span className="sc-field__label">{t("reg.moxfield")}</span>
                            <span className="sc-field__hint">{moxfieldHint()}</span>
                            <input
                              className="sc-input"
                              type="url"
                              placeholder={t("reg.moxfieldPlaceholder")}
                              value={moxfieldUrl}
                              onChange={(e) => setMoxfieldUrl(e.target.value)}
                              disabled={registerBusy}
                            />
                          </label>
                          <label className="sc-field">
                            <span className="sc-field__label">{t("reg.deckName")}</span>
                            <input className="sc-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={registerBusy} />
                          </label>
                          <label className="sc-field">
                            <span className="sc-field__label">{t("reg.pasteShort")}</span>
                            <span className="sc-field__hint">{t("reg.pasteHint")}</span>
                            <textarea className="sc-input" rows={4} value={decklistPaste} onChange={(e) => setDecklistPaste(e.target.value)} disabled={registerBusy} />
                          </label>
                          <button className="sc-btn" type="submit" disabled={registerBusy}>
                            {registerBusy ? t("reg.guest.saving") : t("reg.saveDecklist")}
                          </button>
                        </details>
                      </form>
                      {canLeaveEvent && (
                        <div className="sc-row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                          <button
                            className="sc-btn sc-btn--danger sc-btn--sm"
                            type="button"
                            onClick={() => setLeaveConfirmOpen(true)}
                            disabled={leaveBusy}
                          >
                            {t("overview.leave")}
                          </button>
                        </div>
                      )}
                    </article>
                  ) : (
                    <article className="sc-card cc-reg-easy">
                      <p>{t("reg.deckClosed")}</p>
                      {registration.moxfieldUrl && (
                        <p className="sc-body-sm"><a href={registration.moxfieldUrl} target="_blank" rel="noreferrer">{t("reg.viewMoxfield")}</a></p>
                      )}
                      {canLeaveEvent && (
                        <div className="sc-row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                          <button
                            className="sc-btn sc-btn--danger sc-btn--sm"
                            type="button"
                            onClick={() => setLeaveConfirmOpen(true)}
                            disabled={leaveBusy}
                          >
                            {t("overview.leave")}
                          </button>
                        </div>
                      )}
                    </article>
                  )
                ) : user && registrationOpen ? (
                  <article className="sc-card cc-reg-easy" id={event.decklistRequired || regMode === "decklist" ? "cc-decklist-form" : undefined}>
                    {claimable && (
                      <div className="cc-alert cc-alert--success" style={{ marginBottom: 16 }}>
                        <p>{t("signup.claimFound", { name: formatUserName(user) })}</p>
                        <button className="sc-btn sc-btn--sm" type="button" onClick={() => void handleClaimRegistration()} style={{ marginTop: 8 }}>
                          {t("signup.claim")}
                        </button>
                      </div>
                    )}
                    <h3 className="sc-headline-md">{t("signup.registerAs", { name: formatUserName(user) })}</h3>
                    {event.decklistRequired || regMode === "decklist" ? (
                      <>
                        <p className="sc-body-sm cc-reg-easy__lede">
                          {t("reg.decklist.required")}
                        </p>
                        {moxfieldError && <div className="cc-alert cc-alert--error">{moxfieldError}</div>}
                        <form className="cc-form" onSubmit={handleRegister}>
                          <label className="sc-field">
                            <span className="sc-field__label">{t("reg.moxfield")}</span>
                            <span className="sc-field__hint">{moxfieldHint()}</span>
                            <input
                              className="sc-input"
                              type="url"
                              placeholder={t("reg.moxfieldPlaceholder")}
                              value={moxfieldUrl}
                              onChange={(e) => setMoxfieldUrl(e.target.value)}
                              disabled={registerBusy}
                              required={!decklistPaste.trim()}
                            />
                          </label>
                          <label className="sc-field">
                            <span className="sc-field__label">{t("reg.deckName")}</span>
                            <input className="sc-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={registerBusy} />
                          </label>
                          <label className="sc-field">
                            <span className="sc-field__label">{t("reg.paste")}</span>
                            <span className="sc-field__hint">{t("reg.pasteHint")}</span>
                            <textarea
                              className="sc-input"
                              rows={5}
                              value={decklistPaste}
                              onChange={(e) => setDecklistPaste(e.target.value)}
                              disabled={registerBusy}
                            />
                          </label>
                          <button className="sc-btn sc-btn--lg cc-reg-easy__cta" type="submit" disabled={registerBusy}>
                            {registerBusy ? t("signup.registering") : t("reg.complete")}
                          </button>
                        </form>
                      </>
                    ) : (
                      <>
                        <p className="sc-body-sm cc-reg-easy__lede">{t("reg.oneTap")}</p>
                        {moxfieldError && <div className="cc-alert cc-alert--error">{moxfieldError}</div>}
                        <button
                          className="sc-btn sc-btn--lg cc-reg-easy__cta"
                          type="button"
                          disabled={registerBusy}
                          onClick={() => void submitRegistration({ skipDeck: true })}
                        >
                          <i className="ph ph-ticket" aria-hidden="true" />
                          {registerBusy ? t("signup.registering") : t("signup.registerNow")}
                        </button>
                        <form className="cc-form" onSubmit={handleRegister}>
                          <details className="cc-reg-easy__optional">
                            <summary>{t("reg.addDeckFirst")}</summary>
                            <label className="sc-field">
                              <span className="sc-field__label">{t("reg.moxfield")}</span>
                              <span className="sc-field__hint">{moxfieldHint()}</span>
                              <input
                                className="sc-input"
                                type="url"
                                placeholder={t("reg.moxfieldPlaceholder")}
                                value={moxfieldUrl}
                                onChange={(e) => setMoxfieldUrl(e.target.value)}
                                disabled={registerBusy}
                              />
                            </label>
                            <label className="sc-field">
                              <span className="sc-field__label">{t("reg.deckName")}</span>
                              <input className="sc-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={registerBusy} />
                            </label>
                            <button className="sc-btn" type="submit" disabled={registerBusy}>
                              {registerBusy ? t("signup.registering") : t("reg.withDeck")}
                            </button>
                          </details>
                        </form>
                      </>
                    )}
                  </article>
                ) : registrationOpen ? (
                  user ? null : (
                    <article className="sc-card cc-reg-easy">
                      {isPhone ? (
                        <>
                          <p className="sc-body-sm" style={{ marginBottom: 12 }}>
                            {t("reg.phoneHint")}
                          </p>
                          <button
                            type="button"
                            className="sc-btn"
                            onClick={() => {
                              setDetailsOpen(false);
                              setRegMode("choice");
                              requestAnimationFrame(() => {
                                document.getElementById("cc-signup-gate")?.scrollIntoView({ behavior: "smooth", block: "start" });
                              });
                            }}
                          >
                            {t("reg.backToSignup")}
                          </button>
                        </>
                      ) : regMode === "guest" && event.allowGuestRegistration ? (
                        <form className="cc-form" onSubmit={handleGuestRegister}>
                          <h3 className="sc-headline-md">{t("reg.guest.title")}</h3>
                          <p className="sc-body-sm cc-reg-easy__lede">
                            {event.decklistRequired
                              ? t("reg.guest.ledeRequired")
                              : t("reg.guest.ledeOptional")}
                          </p>
                          {moxfieldError && <div className="cc-alert cc-alert--error">{moxfieldError}</div>}
                          <div className="cc-grid-2">
                            <label className="sc-field">
                              <span className="sc-field__label">{ta("register.firstName")}</span>
                              <input className="sc-input" value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} required disabled={guestBusy} autoComplete="given-name" />
                            </label>
                            <label className="sc-field">
                              <span className="sc-field__label">{ta("register.lastName")}</span>
                              <input className="sc-input" value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} required disabled={guestBusy} autoComplete="family-name" />
                            </label>
                          </div>
                          <PrivacyConsentField
                            id="guest-privacy-consent-desktop"
                            checked={guestPrivacyAccepted}
                            onChange={setGuestPrivacyAccepted}
                          />
                          <TurnstileWidget onToken={onGuestTurnstileToken} />
                          {event.decklistRequired ? (
                            <>
                              <label className="sc-field">
                                <span className="sc-field__label">{t("reg.moxfield")}</span>
                                <span className="sc-field__hint">{moxfieldHint()}</span>
                                <input
                                  className="sc-input"
                                  type="url"
                                  placeholder={t("reg.moxfieldPlaceholder")}
                                  value={moxfieldUrl}
                                  onChange={(e) => setMoxfieldUrl(e.target.value)}
                                  disabled={guestBusy}
                                  required={!decklistPaste.trim()}
                                />
                              </label>
                              <label className="sc-field">
                                <span className="sc-field__label">{t("reg.deckName")}</span>
                                <input className="sc-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={guestBusy} />
                              </label>
                              <label className="sc-field">
                                <span className="sc-field__label">{t("reg.paste")}</span>
                                <textarea
                                  className="sc-input"
                                  rows={4}
                                  value={decklistPaste}
                                  onChange={(e) => setDecklistPaste(e.target.value)}
                                  disabled={guestBusy}
                                />
                              </label>
                            </>
                          ) : (
                            <details className="cc-reg-easy__optional">
                              <summary>{t("reg.guest.optionalDeck")}</summary>
                              <label className="sc-field">
                                <span className="sc-field__label">{t("reg.moxfield")}</span>
                                <span className="sc-field__hint">{moxfieldHint()}</span>
                                <input
                                  className="sc-input"
                                  type="url"
                                  placeholder={t("reg.moxfieldPlaceholder")}
                                  value={moxfieldUrl}
                                  onChange={(e) => setMoxfieldUrl(e.target.value)}
                                  disabled={guestBusy}
                                />
                              </label>
                              <label className="sc-field">
                                <span className="sc-field__label">{t("reg.deckName")}</span>
                                <input className="sc-input" value={deckName} onChange={(e) => setDeckName(e.target.value)} disabled={guestBusy} />
                              </label>
                            </details>
                          )}
                          <button className="sc-btn sc-btn--lg cc-reg-easy__cta" type="submit" disabled={!guestPrivacyAccepted || guestBusy}>
                            {guestBusy ? t("reg.guest.saving") : t("reg.guest.reserve")}
                          </button>
                          <button className="sc-btn sc-btn--ghost" type="button" onClick={() => setRegMode("choice")}>{tc("actions.back")}</button>
                        </form>
                      ) : (
                        <>
                          <h3 className="sc-headline-md">{t("reg.signUpTitle")}</h3>
                          <RegistrationChoiceCards
                            allowGuest={!!event.allowGuestRegistration}
                            onGuest={() => setRegMode("guest")}
                            returnPath={eventReturnPath}
                          />
                        </>
                      )}
                    </article>
                  )
                ) : (
                  <article className="sc-card"><p>{t("overview.closed")}</p></article>
                )}
              </TabPanel>

              <TabPanel id="tournament" active={activeTab === "tournament"}>
                {showTournament && event && (
                  <div className="sc-stack" style={{ gap: 16 }}>
                    {isCompanionLinked && (
                      <CompanionResultsReport
                        standings={companionStandings}
                        registrations={companionRegistrations}
                        companionEventCode={event.companionEventCode ?? null}
                        companionLastPulledAt={event.companionLastPulledAt ?? null}
                        isOrganizer={canManageEvent}
                        busy={companionBusy}
                        onUpdateMoxfield={
                          canManageEvent
                            ? async (registrationId, moxfieldUrl) => {
                                setCompanionBusy(true);
                                try {
                                  await api.updateCompanionMoxfield(eventId, { registrationId, moxfieldUrl });
                                  await loadCompanionResults();
                                  const data = await api.getEvent(eventId);
                                  setRegistrations(data.registrations);
                                  toast(t("toasts.moxfieldUpdated"), "success");
                                } finally {
                                  setCompanionBusy(false);
                                }
                              }
                            : undefined
                        }
                        onRemap={
                          canManageEvent
                            ? async (links) => {
                                setCompanionBusy(true);
                                try {
                                  const res = await api.remapCompanionResults(eventId, links);
                                  setCompanionStandings(res.standings);
                                  setCompanionRegistrations(res.registrations);
                                  toast(
                                    t("toasts.linkedPlayers", { count: res.matchedCount, n: res.matchedCount }),
                                    "success",
                                  );
                                } finally {
                                  setCompanionBusy(false);
                                }
                              }
                            : undefined
                        }
                      />
                    )}
                    {(!isCompanionLinked || matches.length > 0) && (
                      <TournamentPanel
                        event={event}
                        user={user}
                        registration={!!registration}
                        matches={matches}
                        standings={standings}
                        round={round}
                        totalRounds={totalRounds}
                        availableRounds={availableRounds}
                        currentRound={currentRound}
                        isLiveRound={isLiveRound}
                        isOrganizerView={isOrganizerView}
                        pairingBusy={pairingBusy}
                        roundTimer={round === currentRound ? roundTimer : null}
                        phaseKind={phaseKind}
                        onRoundChange={handleRoundChange}
                        onReportResult={updateMatchResult}
                      />
                    )}
                  </div>
                )}
              </TabPanel>

              <TabPanel id="manage" active={activeTab === "manage"}>
                {canManageEvent && (
                  <div className={`cc-event-manage${isPhone ? " cc-event-manage--phone" : ""}`}>
                    <div className="cc-event-manage__ops">
                    {event.joinCode && (
                      <article className="sc-card cc-join-code-card">
                        <h3 className="sc-headline-md">{t("manage.joinCode.title")}</h3>
                        <p className="sc-body-sm">
                          <>{t("manage.joinCode.body").split("centcomp.net/join")[0]}<Link to="/join">centcomp.net/join</Link>{t("manage.joinCode.body").split("centcomp.net/join")[1]}</>
                        </p>
                        <div className="cc-join-code-card__row">
                          <span className="cc-join-code-card__code" aria-label={t("manage.joinCode.aria")}>
                            {event.joinCode}
                          </span>
                          <button className={`sc-btn sc-btn--secondary${isPhone ? " sc-btn--lg cc-event-manage__cta" : " sc-btn--sm"}`} type="button" onClick={copyJoinCode}>
                            <i className="ph ph-copy" /> {t("manage.joinCode.copy")}
                          </button>
                        </div>
                      </article>
                    )}

                    {(event.companionEventCode || event.opsMode === "companion_linked") && (
                      <CompanionPullPanel
                        event={event}
                        busy={pairingBusy || companionBusy}
                        onPull={async (input) => {
                          setCompanionBusy(true);
                          try {
                            const res = await api.pullCompanionResults(eventId, {
                              code: input.companionEventCode,
                              wizardsEmail: input.wizardsEmail,
                              wizardsPassword: input.wizardsPassword,
                              markCompleted: input.markCompleted,
                            });
                            setCompanionStandings(res.standings);
                            setCompanionRegistrations(res.registrations);
                            toast(res.message, "success");
                            await load();
                            await loadPairings();
                            await loadCompanionResults();
                            return {
                              matchedCount: res.matchedCount,
                              unmatchedCount: res.unmatchedCount,
                              standings: res.standings,
                            };
                          } finally {
                            setCompanionBusy(false);
                          }
                        }}
                      />
                    )}

                    {event.status === "upcoming" && event.opsMode !== "companion_linked" && (
                      <article className="sc-card">
                        <h3 className="sc-headline-md">{t("manage.start.title")}</h3>
                        <p className="sc-body-md">
                          {t("manage.start.ready", { count: confirmedTotalCount, n: confirmedTotalCount })}
                          {(regSummary?.confirmedGuests ?? 0) > 0 && (
                            <span> {t("manage.start.guests", { count: regSummary?.confirmedGuests ?? 0, n: regSummary?.confirmedGuests ?? 0 })}</span>
                          )}
                        </p>
                        <button
                          className={`sc-btn sc-btn--danger${isPhone ? " sc-btn--lg cc-event-manage__cta" : ""}`}
                          type="button"
                          disabled={pairingBusy || confirmedTotalCount < 1}
                          onClick={() => setConfirmAction("start")}
                        >
                          <i className="ph ph-play" /> {t("manage.start.title")}
                        </button>
                        {confirmedTotalCount < 1 && (
                          <p className="sc-body-sm" style={{ marginTop: 8 }}>{t("manage.start.needOne")}</p>
                        )}
                      </article>
                    )}

                    {(event.status === "ongoing" || event.status === "upcoming") &&
                      event.opsMode !== "companion_linked" && (
                      <OrganizerConsole
                        event={event}
                        eventId={eventId}
                        registrations={registrations}
                        matches={matches}
                        round={round}
                        currentRound={currentRound}
                        isLiveRound={isLiveRound}
                        pairingBusy={pairingBusy}
                        pendingCount={pendingCount}
                        rerollCount={rerollCount}
                        roundTimer={roundTimer}
                        onRegenerate={async () => {
                          setPairingBusy(true);
                          try {
                            await api.generatePairings(eventId, round, rerollCount > 0 || matches.length > 0);
                            await loadPairings(round);
                            toast(t("toasts.regenerated"), "success");
                          } catch (err) {
                            toast(err instanceof Error ? err.message : t("toasts.regenFailed"), "error");
                          } finally {
                            setPairingBusy(false);
                          }
                        }}
                        onEndRound={() => setConfirmAction("endRound")}
                        onResumeSwiss={() => setConfirmAction("resumeSwiss")}
                        onComplete={() => setConfirmAction("complete")}
                        phaseKind={phaseKind}
                        onDropPlayer={handleDropPlayer}
                        onSavePairings={handleSaveManualPairings}
                        onSetRoundTimer={handleSetRoundTimer}
                      />
                    )}
                    </div>

                    <div className="cc-event-manage__settings">
                    <ManageSection title={t("manage.edit.title")} phone={isPhone}>
                      <form className="cc-form" onSubmit={handleSaveEvent}>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("manage.edit.eventTitle")}</span>
                          <input className="sc-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("manage.edit.store")}</span>
                          <input className="sc-input" value={editStoreName} onChange={(e) => setEditStoreName(e.target.value)} required />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("manage.edit.location")}</span>
                          <LocationSearch
                            value={editLocation}
                            selectedCity={event.eventType === "local_league" ? editDerivedCity : null}
                            onValueChange={(next) => { setEditLocation(next); setEditDerivedCity(null); }}
                            onSelect={(place) => { setEditLocation(place.location); setEditDerivedCity(place.city); }}
                            placeholder={tc("location.placeholderVenue")}
                          />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("manage.edit.starts")}</span>
                          <input className="sc-input" type="datetime-local" value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)} required />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("manage.edit.description")}</span>
                          <textarea className="sc-input" rows={4} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                        </label>
                        <label className="sc-field cc-checkbox-field">
                          <input
                            type="checkbox"
                            checked={editAllowGuest}
                            onChange={(e) => setEditAllowGuest(e.target.checked)}
                          />
                          <span>{t("manage.edit.allowGuest")}</span>
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("manage.edit.opsMode")}</span>
                          <select className="sc-input" value={editOpsMode} onChange={(e) => setEditOpsMode(e.target.value as typeof editOpsMode)} disabled={event.status !== "upcoming"}>
                            <option value="native">{t("manage.edit.native")}</option>
                            <option value="companion_linked">{t("manage.edit.companion")}</option>
                          </select>
                        </label>
                        {editOpsMode === "companion_linked" ? (
                          <label className="sc-field">
                            <span className="sc-field__label">{t("manage.edit.companionCode")}</span>
                            <input className="sc-input" value={editCompanionCode} onChange={(e) => setEditCompanionCode(e.target.value.toUpperCase())} maxLength={16} />
                          </label>
                        ) : (
                          <>
                            <label className="sc-field">
                              <span className="sc-field__label">{t("manage.edit.structure")}</span>
                              <select className="sc-input" value={editStructure} onChange={(e) => setEditStructure(e.target.value as typeof editStructure)} disabled={event.status !== "upcoming"}>
                                <option value="swiss">{t("manage.edit.swiss")}</option>
                                <option value="swiss_top_cut">{t("manage.edit.swissTop")}</option>
                                <option value="single_elim">{t("manage.edit.singleElim")}</option>
                              </select>
                            </label>
                            <label className="sc-field">
                              <span className="sc-field__label">{t("manage.edit.swissRounds")}</span>
                              <input className="sc-input" type="number" min={1} max={20} value={editSwissRounds} onChange={(e) => setEditSwissRounds(e.target.value)} placeholder={t("manage.edit.swissRounds")} />
                            </label>
                            {(editStructure === "swiss_top_cut" || event.tournamentStructure === "swiss_top_cut") && (
                              <label className="sc-field">
                                <span className="sc-field__label">{t("manage.edit.topCut")}</span>
                                <select className="sc-input" value={editTopCut} onChange={(e) => setEditTopCut(e.target.value as typeof editTopCut)}>
                                  <option value="8">8</option>
                                  <option value="4">4</option>
                                  <option value="2">2</option>
                                </select>
                              </label>
                            )}
                            <label className="sc-field cc-checkbox-field">
                              <input type="checkbox" checked={editLateEnroll} onChange={(e) => setEditLateEnroll(e.target.checked)} />
                              <span>{t("manage.edit.lateEnroll")}</span>
                            </label>
                          </>
                        )}
                        <label className="sc-field cc-checkbox-field">
                          <input type="checkbox" checked={editDecklistRequired} onChange={(e) => setEditDecklistRequired(e.target.checked)} />
                          <span>{t("manage.edit.requireDeck")}</span>
                        </label>
                        <button className={`sc-btn${isPhone ? " sc-btn--lg cc-event-manage__cta" : ""}`} type="submit">
                          <i className="ph ph-floppy-disk" /> {t("manage.edit.save")}
                        </button>
                      </form>
                    </ManageSection>

                    <ManageSection title={t("manage.staff.title")} phone={isPhone}>
                      <form
                        className="cc-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          try {
                            await api.addEventStaff(eventId, staffLogin, staffRole);
                            setStaffLogin("");
                            const data = await api.getEventStaff(eventId);
                            setStaff(data.staff);
                            toast(t("toasts.staffAdded"), "success");
                          } catch (err) {
                            toast(err instanceof Error ? err.message : t("toasts.failed"), "error");
                          }
                        }}
                      >
                        <label className="sc-field">
                          <span className="sc-field__label">{t("manage.staff.login")}</span>
                          <input className="sc-input" value={staffLogin} onChange={(e) => setStaffLogin(e.target.value)} required />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("manage.staff.role")}</span>
                          <select className="sc-input" value={staffRole} onChange={(e) => setStaffRole(e.target.value as typeof staffRole)}>
                            <option value="co_organizer">{t("manage.staff.coOrganizer")}</option>
                            <option value="judge">{t("manage.staff.judge")}</option>
                            <option value="scorekeeper">{t("manage.staff.scorekeeper")}</option>
                          </select>
                        </label>
                        <button className={`sc-btn${isPhone ? " sc-btn--lg cc-event-manage__cta" : " sc-btn--sm"}`} type="submit">{t("manage.staff.add")}</button>
                      </form>
                      <ul className="sc-stack" style={{ gap: 8, listStyle: "none", padding: 0, marginTop: 12 }}>
                        {staff.map((s) => (
                          <li key={s.id} className="sc-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                            <span>{s.displayName} · {s.role}</span>
                            <button
                              type="button"
                              className="sc-btn sc-btn--ghost sc-btn--sm"
                              onClick={async () => {
                                await api.removeEventStaff(eventId, s.userId);
                                setStaff((prev) => prev.filter((x) => x.id !== s.id));
                              }}
                            >
                              {t("manage.staff.remove")}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className={`sc-btn sc-btn--secondary${isPhone ? " sc-btn--lg cc-event-manage__cta" : " sc-btn--sm"}`}
                        style={{ marginTop: 8 }}
                        onClick={async () => {
                          try {
                            const blob = await api.exportDecklists(eventId, "csv");
                            if (blob instanceof Blob) {
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `event-${eventId}-decklists.csv`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }
                          } catch (err) {
                            toast(err instanceof Error ? err.message : t("toasts.exportFailed"), "error");
                          }
                        }}
                      >
                        {t("manage.exportDecklists")}
                      </button>
                    </ManageSection>

                    {event.status === "upcoming" && (
                      <article className="sc-card">
                        <h3 className="sc-headline-md">{t("manage.danger")}</h3>
                        <button className={`sc-btn sc-btn--danger${isPhone ? " sc-btn--lg cc-event-manage__cta" : " sc-btn--sm"}`} type="button" onClick={() => setConfirmAction("cancel")}>
                          <i className="ph ph-x-circle" /> {t("confirm.cancel.label")}
                        </button>
                      </article>
                    )}
                    </div>
                  </div>
                )}
              </TabPanel>
              </div>
                </>
              ) : null}
            </>
          ) : (
            <article className="sc-card cc-event-not-found">
              <h2 className="sc-headline-md">{t("detail.notFound.title")}</h2>
              <p className="sc-body-sm">
                {t("detail.notFound.body")}
              </p>
              <p className="sc-body-sm">
                {t("detail.notFound.hint")}
              </p>
              <Link to="/events" className="sc-btn" style={{ marginTop: 16 }}>
                {tc("actions.browseEvents")}
              </Link>
            </article>
          )}
        </div>
      </section>

      {confirmAction && (
        <Modal
          open
          title={confirmCopy[confirmAction].title}
          confirmLabel={confirmCopy[confirmAction].label}
          confirmVariant={confirmCopy[confirmAction].variant}
          onConfirm={() => void runConfirmAction()}
          onCancel={() => setConfirmAction(null)}
          busy={pairingBusy}
        >
          <p>{confirmCopy[confirmAction].body}</p>
        </Modal>
      )}

      {leaveConfirmOpen && (
        <Modal
          open
          title={t("confirm.leave.title")}
          confirmLabel={t("confirm.leave.label")}
          confirmVariant="danger"
          onConfirm={() => void handleLeaveEvent()}
          onCancel={() => setLeaveConfirmOpen(false)}
          busy={leaveBusy}
        >
          <p>
            {registration?.registrationStatus === "confirmed"
              ? t("confirm.leave.bodyWaitlist")
              : t("confirm.leave.body")}
          </p>
        </Modal>
      )}

      {event && (
        <EventStickyCta
          event={event}
          registrationOpen={registrationOpen}
          isRegistered={!!registration || !!guestRegistration}
          myMatchLabel={stickyMatchLabel}
          onRegister={scrollToSignup}
          onTournament={() => goToTab("tournament")}
          showTournament={!!showTournament}
        />
      )}
    </Page>
  );
}
