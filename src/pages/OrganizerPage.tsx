import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { api, type EventItem } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useGeo } from "../hooks/useGeo";
import { useToast } from "../hooks/useToast";
import { useIsPhone } from "../hooks/useIsPhone";
import { Page, SlidePanel, TabPanel, Tabs } from "../components/Motion";
import { LocationSearch, resolveCityFromLocation } from "../components/LocationSearch";
import { SkeletonCard } from "../components/Skeleton";
import {
  eventStatusChipClass,
  eventStatusLabel,
  eventTypeLabel,
  formatEventDateParts,
} from "../lib/eventDisplay";
import { formatAppDate, formatAppDateTime } from "../lib/formatLocale";

const EVENT_TYPE_META = [
  { value: "casual" as const, icon: "ph-coffee" },
  { value: "local_league" as const, icon: "ph-calendar-check" },
  { value: "lv1" as const, icon: "ph-medal" },
  { value: "lv2" as const, icon: "ph-trophy" },
] as const;

type HubTab = "events" | "create" | "help";
type WizardStep = 0 | 1 | 2 | 3;

function statusChip(status: string, approval?: string) {
  if (approval === "pending_review") return "sc-chip--gold";
  if (status === "ongoing") return "sc-chip--cyan";
  if (status === "completed") return "sc-chip--primary";
  if (status === "cancelled") return "sc-chip--red";
  return "sc-chip--primary";
}

function OrganizerEventRow({ event }: { event: EventItem }) {
  const { t } = useTranslation("events");
  const date = formatEventDateParts(event.startsAt);
  const pending = event.approvalStatus === "pending_review";
  const to =
    event.status === "ongoing"
      ? `/events/${event.id}?tab=tournament`
      : event.status === "upcoming" && !pending
        ? `/events/${event.id}?tab=manage`
        : `/events/${event.id}`;

  return (
    <Link to={to} className="cc-organizer-phone-row" role="listitem">
      <div className="cc-organizer-phone-row__body">
        <div className="cc-organizer-phone-row__top">
          <span className="cc-organizer-phone-row__title">{event.title}</span>
          <span className={`sc-chip ${pending ? "sc-chip--gold" : eventStatusChipClass(event.status)}`}>
            {pending ? t("organizer.pending") : eventStatusLabel(event.status)}
          </span>
        </div>
        <span className="cc-organizer-phone-row__meta">
          {date.weekday} {date.day} {date.month} · {date.time}
        </span>
        <span className="cc-organizer-phone-row__meta cc-organizer-phone-row__meta--soft">
          {eventTypeLabel(event.eventType)} · {event.storeName}
        </span>
      </div>
      <i className="ph ph-caret-right cc-organizer-phone-row__chevron" aria-hidden="true" />
    </Link>
  );
}

export function OrganizerPage() {
  const { t } = useTranslation("events");
  const { t: tc } = useTranslation("common");
  const { user } = useAuth();
  const geo = useGeo();
  const { toast } = useToast();
  const isPhone = useIsPhone();

  const EVENT_TYPES = EVENT_TYPE_META.map((opt) => ({
    ...opt,
    label: t(`organizer.type.${opt.value === "local_league" ? "league" : opt.value}.label`),
    desc: t(`organizer.type.${opt.value === "local_league" ? "league" : opt.value}.desc`),
  }));

  const [searchParams, setSearchParams] = useSearchParams();

  const [hubTab, setHubTab] = useState<HubTab>(
    (searchParams.get("tab") as HubTab) || "events",
  );
  const [myEvents, setMyEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [createdEvent, setCreatedEvent] = useState<EventItem | null>(null);

  const [title, setTitle] = useState("");
  const [storeName, setStoreName] = useState(user?.storeName ?? "");
  const [location, setLocation] = useState("");
  const [derivedCity, setDerivedCity] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<(typeof EVENT_TYPE_META)[number]["value"]>("casual");
  const [startsAt, setStartsAt] = useState("");
  const [dateMode, setDateMode] = useState<"single" | "manual_dates" | "weekly">("single");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [manualDate, setManualDate] = useState("");
  const [weeklyDay, setWeeklyDay] = useState("5");
  const [weeklyStartDate, setWeeklyStartDate] = useState("");
  const [weeklyOccurrences, setWeeklyOccurrences] = useState(4);
  const [weeklyTime, setWeeklyTime] = useState("19:30");
  const [submitting, setSubmitting] = useState(false);
  const [tournamentStructure, setTournamentStructure] = useState<"swiss" | "swiss_top_cut" | "single_elim">("swiss");
  const [opsMode, setOpsMode] = useState<"native" | "companion_linked">("native");
  const [swissRounds, setSwissRounds] = useState("");
  const [topCutSize, setTopCutSize] = useState<"8" | "4" | "2">("8");
  const [allowLateEnrollment, setAllowLateEnrollment] = useState(false);
  const [companionEventCode, setCompanionEventCode] = useState("");
  const [decklistRequired, setDecklistRequired] = useState(false);

  useEffect(() => {
    if (!user || (user.role !== "coordinator" && user.role !== "admin")) return;
    setLoadingEvents(true);
    api
      .getEvents()
      .then((d) => {
        setMyEvents(d.events.filter((ev) => ev.organizerId === user.id));
      })
      .catch(() => toast(t("organizer.loadFailed"), "error"))
      .finally(() => setLoadingEvents(false));
  }, [user, toast]);

  useEffect(() => {
    setSearchParams({ tab: hubTab }, { replace: true });
  }, [hubTab, setSearchParams]);

  const goStep = (next: WizardStep) => {
    setDirection(next > wizardStep ? 1 : -1);
    setWizardStep(next);
  };

  const resetWizard = () => {
    setWizardStep(0);
    setCreatedEvent(null);
    setTitle("");
    setDescription("");
    setLocation("");
    setDerivedCity(null);
    setStartsAt("");
    setSelectedDates([]);
    setEventType("casual");
    setDateMode("single");
  };

  const weeklyPreview = useMemo(() => {
    if (!weeklyStartDate || weeklyOccurrences < 1) return [];
    const start = new Date(`${weeklyStartDate}T00:00:00`);
    const targetDay = Number(weeklyDay);
    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor.getDay() !== targetDay) cursor.setDate(cursor.getDate() + 1);
    for (let i = 0; i < weeklyOccurrences; i += 1) {
      const isoDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      dates.push(`${isoDate}T${weeklyTime}`);
      cursor.setDate(cursor.getDate() + 7);
    }
    return dates;
  }, [weeklyDay, weeklyOccurrences, weeklyStartDate, weeklyTime]);

  const generateWeeklyDates = () => setSelectedDates(weeklyPreview);

  const addManualDate = () => {
    if (!manualDate) return;
    setSelectedDates((prev) =>
      prev.includes(manualDate) ? prev : [...prev, manualDate].sort(),
    );
    setManualDate("");
  };

  const removeDate = (d: string) => {
    setSelectedDates((prev) => prev.filter((x) => x !== d));
  };

  const hubStats = useMemo(
    () => [
      { label: t("organizer.stats.total"), short: t("organizer.statsShort.total"), value: myEvents.length, icon: "ph-calendar" },
      { label: t("organizer.stats.upcoming"), short: t("organizer.statsShort.upcoming"), value: myEvents.filter((ev) => ev.status === "upcoming").length, icon: "ph-clock" },
      { label: t("organizer.stats.live"), short: t("organizer.statsShort.live"), value: myEvents.filter((ev) => ev.status === "ongoing").length, icon: "ph-broadcast" },
    ],
    [myEvents, t],
  );

  const canProceedStep0 = true;
  const canProceedStep1 =
    title.trim().length >= 3 &&
    storeName.trim().length >= 2 &&
    (eventType !== "local_league" || location.trim().length > 0) &&
    (dateMode !== "single" || startsAt.length > 0) &&
    (dateMode === "single" || selectedDates.length > 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let city = derivedCity;
      if (eventType === "local_league" && !city && location.trim()) {
        try {
          city = await resolveCityFromLocation(location, geo);
        } catch {
          city = null;
        }
      }
      if (eventType === "local_league" && !city) {
        toast(t("organizer.toasts.cityRequired"), "error");
        return;
      }

      const startsAtDates = selectedDates.map((d) => (d.includes("T") ? d : `${d}T${weeklyTime}`));
      const payloadDates =
        eventType === "local_league" && dateMode !== "single"
          ? startsAtDates
          : startsAt
            ? [startsAt]
            : startsAtDates;

      const data = await api.createEvent({
        title,
        storeName,
        location,
        city: city ?? undefined,
        description,
        eventType,
        startsAt: payloadDates[0],
        startsAtDates: payloadDates,
        format: tournamentStructure === "single_elim" ? "Single Elimination" : "Swiss",
        tournamentStructure,
        opsMode,
        swissRounds: swissRounds ? Number(swissRounds) : null,
        topCutSize: tournamentStructure === "swiss_top_cut" ? (Number(topCutSize) as 2 | 4 | 8) : null,
        allowLateEnrollment,
        decklistRequired,
        companionEventCode: companionEventCode.trim() || null,
      });

      const created = data.event ?? data.events?.[0] ?? null;
      setCreatedEvent(created);
      if (data.pendingApproval) {
        toast(t("organizer.toasts.submitted"), "success");
      } else {
        toast(t("organizer.toasts.created"), "success");
      }
      if (created) {
        setMyEvents((prev) => [created, ...prev]);
      }
      goStep(3);
    } catch (err) {
      toast(err instanceof Error ? err.message : t("organizer.toasts.createFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || (user.role !== "coordinator" && user.role !== "admin")) {
    return (
      <Page className="cc-organizer-page">
        <div className="sc-container cc-section">
          <article className="sc-card cc-organizer-phone__denied">
            <p>{t("organizer.denied")}</p>
            <Link to="/settings" className="sc-btn sc-btn--lg cc-organizer-phone__cta">
              {t("organizer.apply")}
            </Link>
          </article>
        </div>
      </Page>
    );
  }

  const hubTabs = isPhone
    ? [
        { id: "events" as const, label: t("organizer.tabs.eventsShort"), icon: "ph-list-bullets" },
        { id: "create" as const, label: t("organizer.tabs.createShort"), icon: "ph-plus-circle" },
        { id: "help" as const, label: t("organizer.tabs.help"), icon: "ph-question" },
      ]
    : [
        { id: "events" as const, label: t("organizer.tabs.events"), icon: "ph-list-bullets" },
        { id: "create" as const, label: t("organizer.tabs.create"), icon: "ph-plus-circle" },
        { id: "help" as const, label: t("organizer.tabs.help"), icon: "ph-question" },
      ];

  return (
    <Page className="cc-organizer-page">
      <section className="cc-section cc-organizer-hub">
        <div className="sc-container">
          {!isPhone && (
            <header className="cc-hub-header">
              <div className="cc-hub-header__text">
                <span className="sc-chip sc-chip--cyan" style={{ marginBottom: 12, display: "inline-flex" }}>
                  <i className="ph ph-calendar-plus" /> {t("organizer.chip")}
                </span>
                <h2 className="sc-headline-lg">{t("organizer.hub.title")}</h2>
              </div>
              <div className="cc-hub-stats">
                {hubStats.map((s) => (
                  <div key={s.label} className="cc-hub-cell">
                    <div className="cc-hub-cell__hd">
                      <span className="cc-hub-cell__label">{s.label}</span>
                      <i className={`ph ${s.icon}`} aria-hidden="true" />
                    </div>
                    <span className="cc-hub-cell__value">{s.value}</span>
                  </div>
                ))}
              </div>
            </header>
          )}

          {isPhone && (
            <div className="cc-organizer-phone__stats" aria-label={t("organizer.statsAria")}>
              {hubStats.map((s) => (
                <div key={s.label} className="cc-organizer-phone__stat">
                  <strong>{s.value}</strong>
                  <span>{s.short}</span>
                </div>
              ))}
            </div>
          )}

          <div className={isPhone ? "cc-organizer-phone" : "cc-page-split"}>
            <aside className={isPhone ? "cc-organizer-phone__nav" : "cc-page-split__aside"}>
              <Tabs
                tabs={hubTabs}
                active={hubTab}
                onChange={(tab) => {
                  setHubTab(tab);
                  if (tab === "create" && createdEvent) resetWizard();
                }}
                ariaLabel={t("organizer.tabs.aria")}
                layout={isPhone ? "bar" : "sidebar"}
                variant={isPhone ? "motion" : "spritecraft"}
                className={isPhone ? "cc-organizer-phone__tabs" : ""}
              />
            </aside>

            <div className={isPhone ? "cc-organizer-phone__main" : "cc-page-split__main"}>
          <TabPanel id="events" active={hubTab === "events"} className="cc-organizer-panel">
            {loadingEvents ? (
              <div className="sc-stack" style={{ gap: 16 }}>
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : myEvents.length === 0 ? (
              <div className={isPhone ? "cc-organizer-phone__empty" : "cc-hub-panel"}>
                {!isPhone && (
                  <div className="cc-hub-panel__head">
                    <h3 className="cc-hub-panel__title">{t("organizer.tabs.events")}</h3>
                  </div>
                )}
                <p className={isPhone ? undefined : "sc-body-md"}>{t("organizer.empty")}</p>
                <button
                  className={`sc-btn${isPhone ? " sc-btn--lg cc-organizer-phone__cta" : " sc-btn--sm"}`}
                  type="button"
                  onClick={() => setHubTab("create")}
                  style={isPhone ? undefined : { marginTop: 16 }}
                >
                  <i className="ph ph-plus" /> {t("organizer.tabs.create")}
                </button>
              </div>
            ) : isPhone ? (
              <div className="cc-organizer-phone__list" role="list">
                {myEvents.map((ev) => (
                  <OrganizerEventRow key={ev.id} event={ev} />
                ))}
              </div>
            ) : (
              <div className="cc-hub-panel">
                <div className="cc-hub-panel__head">
                  <h3 className="cc-hub-panel__title">{t("organizer.tabs.events")}</h3>
                  <span className="sc-chip sc-chip--primary">{t("organizer.totalChip", { n: myEvents.length })}</span>
                </div>
                <div className="cc-hub-grid">
                {myEvents.map((ev) => (
                  <article key={ev.id} className="cc-hub-card">
                    <div className="sc-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <h4 className="cc-hub-card__title">{ev.title}</h4>
                      <div className="sc-row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <span className={`sc-chip ${statusChip(ev.status, ev.approvalStatus)}`}>
                          {ev.approvalStatus === "pending_review" ? t("organizer.pendingBadge") : ev.status.toUpperCase()}
                        </span>
                        <span className="sc-chip sc-chip--cyan">{(ev.eventType ?? "casual").toUpperCase()}</span>
                      </div>
                    </div>
                    <p className="sc-body-sm">
                      {formatAppDateTime(ev.startsAt)} · {ev.storeName}
                    </p>
                    <div className="sc-row" style={{ marginTop: "auto", gap: 8, flexWrap: "wrap" }}>
                      <Link to={`/events/${ev.id}`} className="sc-btn sc-btn--sm">
                        {t("organizer.openEvent")}
                      </Link>
                      {ev.status === "upcoming" && ev.approvalStatus !== "pending_review" && (
                        <Link to={`/events/${ev.id}?tab=manage`} className="sc-btn sc-btn--secondary sc-btn--sm">
                          {t("hero.manage")}
                        </Link>
                      )}
                      {ev.status === "ongoing" && (
                        <Link to={`/events/${ev.id}?tab=tournament`} className="sc-btn sc-btn--secondary sc-btn--sm">
                          {t("organizer.liveTournament")}
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
                </div>
              </div>
            )}
          </TabPanel>

          <TabPanel id="create" active={hubTab === "create"} className="cc-organizer-panel">
            <div className={`cc-console${isPhone ? " cc-console--phone" : ""}`}>
              <div className="cc-console__head">
                {!isPhone && (
                  <span className="cc-console__dots" aria-hidden="true">
                    <span /><span /><span />
                  </span>
                )}
                <span>{isPhone ? t("organizer.wizard.step", { n: Math.min(wizardStep + 1, 4) }) : t("organizer.wizard.builder")}</span>
                {!isPhone && <span>{t("organizer.wizard.step", { n: Math.min(wizardStep + 1, 4) })}</span>}
              </div>
              <div className="cc-console__screen">
                <div className="cc-wizard-steps" aria-hidden="true">
                  {[t("organizer.wizard.steps.type"), t("organizer.wizard.steps.schedule"), t("organizer.wizard.steps.details"), t("organizer.wizard.steps.done")].map((label, i) => (
                    <span
                      key={label}
                      className={`cc-wizard-step${i <= wizardStep ? " cc-wizard-step--active" : ""}${i === wizardStep ? " cc-wizard-step--current" : ""}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <AnimatePresence mode="wait" custom={direction}>
                  {wizardStep === 0 && (
                    <SlidePanel key="step0" direction={direction}>
                      <h3 className="sc-headline-md">{t("organizer.type.question")}</h3>
                      <div className="cc-type-grid">
                        {EVENT_TYPES.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`cc-type-card${eventType === opt.value ? " cc-type-card--active" : ""}`}
                            onClick={() => {
                              setEventType(opt.value);
                              setDateMode(opt.value === "local_league" ? "weekly" : "single");
                            }}
                          >
                            <i className={`ph ${opt.icon}`} aria-hidden="true" />
                            <strong>{opt.label}</strong>
                            <span>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                      <div className="cc-wizard-nav">
                        <button className="sc-btn" type="button" disabled={!canProceedStep0} onClick={() => goStep(1)}>
                          {tc("actions.next")} <i className="ph ph-arrow-right" />
                        </button>
                      </div>
                    </SlidePanel>
                  )}

                  {wizardStep === 1 && (
                    <SlidePanel key="step1" direction={direction}>
                      <form className="cc-form" onSubmit={(e) => { e.preventDefault(); if (canProceedStep1) goStep(2); }}>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("organizer.form.title")}</span>
                          <input className="sc-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("organizer.form.store")}</span>
                          <input className="sc-input" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("organizer.form.location")}</span>
                          <LocationSearch
                            value={location}
                            selectedCity={eventType === "local_league" ? derivedCity : null}
                            onValueChange={(next) => { setLocation(next); setDerivedCity(null); }}
                            onSelect={(place) => { setLocation(place.location); setDerivedCity(place.city); }}
                            placeholder={tc("location.placeholderVenue")}
                            required={eventType === "local_league"}
                          />
                          {eventType === "local_league" && (
                            <p className="sc-body-sm" style={{ marginTop: 8 }}>
                              {t("organizer.form.cityHint")}
                            </p>
                          )}
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("organizer.form.scheduleMode")}</span>
                          <select className="sc-input" value={dateMode} onChange={(e) => setDateMode(e.target.value as typeof dateMode)}>
                            <option value="single">{t("organizer.form.single")}</option>
                            {eventType === "local_league" && <option value="weekly">{t("organizer.form.weekly")}</option>}
                            {eventType === "local_league" && <option value="manual_dates">{t("organizer.form.manual")}</option>}
                          </select>
                        </label>
                        {dateMode === "single" && (
                          <label className="sc-field">
                            <span className="sc-field__label">{t("organizer.form.starts")}</span>
                            <input className="sc-input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
                          </label>
                        )}
                        {dateMode === "manual_dates" && (
                          <div className="sc-field">
                            <span className="sc-field__label">{t("organizer.form.addDates")}</span>
                            <div className="sc-row" style={{ gap: 8, flexWrap: "wrap" }}>
                              <input className="sc-input" type="datetime-local" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                              <button className="sc-btn sc-btn--sm sc-btn--secondary" type="button" onClick={addManualDate}>{t("organizer.form.add")}</button>
                            </div>
                          </div>
                        )}
                        {dateMode === "weekly" && (
                          <div className="sc-field">
                            <span className="sc-field__label">{t("organizer.form.weeklyPlanner")}</span>
                            <div className="cc-grid-2">
                              <label className="sc-field">
                                <span className="sc-field__label">{t("organizer.form.startingFrom")}</span>
                                <input className="sc-input" type="date" value={weeklyStartDate} onChange={(e) => setWeeklyStartDate(e.target.value)} />
                              </label>
                              <label className="sc-field">
                                <span className="sc-field__label">{t("organizer.form.weekday")}</span>
                                <select className="sc-input" value={weeklyDay} onChange={(e) => setWeeklyDay(e.target.value)}>
                                  <option value="5">{t("organizer.form.weekdays.5")}</option>
                                  <option value="4">{t("organizer.form.weekdays.4")}</option>
                                  <option value="6">{t("organizer.form.weekdays.6")}</option>
                                  <option value="0">{t("organizer.form.weekdays.0")}</option>
                                  <option value="1">{t("organizer.form.weekdays.1")}</option>
                                  <option value="2">{t("organizer.form.weekdays.2")}</option>
                                  <option value="3">{t("organizer.form.weekdays.3")}</option>
                                </select>
                              </label>
                              <label className="sc-field">
                                <span className="sc-field__label">{t("organizer.form.time")}</span>
                                <input className="sc-input" type="time" value={weeklyTime} onChange={(e) => setWeeklyTime(e.target.value)} />
                              </label>
                              <label className="sc-field">
                                <span className="sc-field__label">{t("organizer.form.occurrences")}</span>
                                <input className="sc-input" type="number" min={1} max={12} value={weeklyOccurrences} onChange={(e) => setWeeklyOccurrences(Number(e.target.value))} />
                              </label>
                            </div>
                            {weeklyPreview.length > 0 && (
                              <div className="cc-weekly-preview">
                                <p className="sc-body-sm">{t("organizer.form.preview")}</p>
                                <div className="sc-row" style={{ flexWrap: "wrap", gap: 6 }}>
                                  {weeklyPreview.map((d) => (
                                    <span key={d} className="sc-chip sc-chip--cyan sc-btn--sm">
                                      {formatAppDate(d, { weekday: "short", month: "short", day: "numeric" })}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <button className="sc-btn sc-btn--sm sc-btn--secondary" type="button" onClick={generateWeeklyDates} style={{ marginTop: 8 }}>
                              {t("organizer.form.applyDates")}
                            </button>
                          </div>
                        )}
                        {selectedDates.length > 0 && (
                          <div className="sc-field">
                            <span className="sc-field__label">{t("organizer.form.planned")}</span>
                            <div className="sc-row" style={{ flexWrap: "wrap", gap: 8 }}>
                              {selectedDates.map((d) => (
                                <button key={d} type="button" className="sc-chip sc-chip--cyan cc-date-chip" onClick={() => removeDate(d)}>
                                  {formatAppDateTime(d)} <i className="ph ph-x" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="cc-wizard-nav">
                          <button className="sc-btn sc-btn--ghost" type="button" onClick={() => goStep(0)}>{tc("actions.back")}</button>
                          <button className="sc-btn" type="submit" disabled={!canProceedStep1}>{tc("actions.next")}</button>
                        </div>
                      </form>
                    </SlidePanel>
                  )}

                  {wizardStep === 2 && (
                    <SlidePanel key="step2" direction={direction}>
                      <form className="cc-form" onSubmit={handleSubmit}>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("organizer.form.description")}</span>
                          <textarea className="sc-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("organizer.form.descPh")} />
                        </label>
                        <label className="sc-field">
                          <span className="sc-field__label">{t("organizer.form.opsMode")}</span>
                          <select className="sc-input" value={opsMode} onChange={(e) => setOpsMode(e.target.value as typeof opsMode)}>
                            <option value="native">{t("organizer.form.opsNative")}</option>
                            <option value="companion_linked">{t("organizer.form.opsCompanion")}</option>
                          </select>
                        </label>
                        {opsMode === "companion_linked" ? (
                          <label className="sc-field">
                            <span className="sc-field__label">{t("organizer.form.companionCode")}</span>
                            <input className="sc-input" value={companionEventCode} onChange={(e) => setCompanionEventCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={16} />
                          </label>
                        ) : (
                          <>
                            <label className="sc-field">
                              <span className="sc-field__label">{t("organizer.form.structure")}</span>
                              <select className="sc-input" value={tournamentStructure} onChange={(e) => setTournamentStructure(e.target.value as typeof tournamentStructure)}>
                                <option value="swiss">{t("organizer.form.swiss")}</option>
                                <option value="swiss_top_cut">{t("organizer.form.swissTop")}</option>
                                <option value="single_elim">{t("organizer.form.singleElim")}</option>
                              </select>
                            </label>
                            {tournamentStructure !== "single_elim" && (
                              <label className="sc-field">
                                <span className="sc-field__label">{t("organizer.form.swissRounds")}</span>
                                <input className="sc-input" type="number" min={1} max={20} value={swissRounds} onChange={(e) => setSwissRounds(e.target.value)} placeholder={t("organizer.form.swissAuto")} />
                              </label>
                            )}
                            {tournamentStructure === "swiss_top_cut" && (
                              <label className="sc-field">
                                <span className="sc-field__label">{t("organizer.form.topCutSize")}</span>
                                <select className="sc-input" value={topCutSize} onChange={(e) => setTopCutSize(e.target.value as typeof topCutSize)}>
                                  <option value="8">{t("organizer.form.top8")}</option>
                                  <option value="4">{t("organizer.form.top4")}</option>
                                  <option value="2">{t("organizer.form.top2")}</option>
                                </select>
                              </label>
                            )}
                            <label className="sc-field cc-checkbox-field">
                              <input type="checkbox" checked={allowLateEnrollment} onChange={(e) => setAllowLateEnrollment(e.target.checked)} />
                              <span>{t("organizer.form.lateEnroll")}</span>
                            </label>
                          </>
                        )}
                        <label className="sc-field cc-checkbox-field">
                          <input type="checkbox" checked={decklistRequired} onChange={(e) => setDecklistRequired(e.target.checked)} />
                          <span>{t("organizer.form.requireDeck")}</span>
                        </label>
                        <article className="sc-card cc-review-card">
                          <h4 className="sc-headline-md">{t("organizer.form.review")}</h4>
                          <p><strong>{title}</strong> · {EVENT_TYPES.find((opt) => opt.value === eventType)?.label}</p>
                          <p className="sc-body-sm">{storeName} · {location || t("organizer.form.noLocation")}</p>
                          <p className="sc-body-sm">
                            {dateMode === "single"
                              ? formatAppDateTime(startsAt)
                              : t("organizer.form.datesCount", { count: selectedDates.length, n: selectedDates.length })}
                          </p>
                        </article>
                        <div className="cc-wizard-nav">
                          <button className="sc-btn sc-btn--ghost" type="button" onClick={() => goStep(1)}>{tc("actions.back")}</button>
                          <button className="sc-btn" type="submit" disabled={submitting}>
                            <i className="ph ph-calendar-plus" /> {submitting ? t("organizer.form.creating") : t("organizer.form.create")}
                          </button>
                        </div>
                      </form>
                    </SlidePanel>
                  )}

                  {wizardStep === 3 && (
                    <SlidePanel key="step3" direction={direction}>
                      <div className="cc-success-screen">
                        <i className="ph ph-check-circle cc-success-screen__icon" aria-hidden="true" />
                        <h3 className="sc-headline-md">{t("organizer.success.title")}</h3>
                        {createdEvent?.approvalStatus === "pending_review" ? (
                          <p>{t("organizer.success.pending")}</p>
                        ) : (
                          <p>{t("organizer.success.live")}</p>
                        )}
                        <div className="sc-row" style={{ gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                          {createdEvent && (
                            <Link to={`/events/${createdEvent.id}`} className="sc-btn">
                              {t("organizer.success.view")}
                            </Link>
                          )}
                          <button className="sc-btn sc-btn--secondary" type="button" onClick={() => { resetWizard(); goStep(0); }}>
                            {t("organizer.success.another")}
                          </button>
                          <button className="sc-btn sc-btn--ghost" type="button" onClick={() => setHubTab("events")}>
                            {t("organizer.tabs.events")}
                          </button>
                        </div>
                      </div>
                    </SlidePanel>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </TabPanel>

          <TabPanel id="help" active={hubTab === "help"} className="cc-organizer-panel">
            <div className={isPhone ? "cc-organizer-phone__help" : "cc-hub-panel sc-card--scroll"}>
              {!isPhone && (
                <div className="cc-hub-panel__head">
                  <h3 className="cc-hub-panel__title">{t("organizer.help.title")}</h3>
                </div>
              )}
              <ul className="cc-help-list">
                <li>{t("organizer.help.1")}</li>
                <li>{t("organizer.help.2")}</li>
                <li>{t("organizer.help.3")}</li>
                <li>{t("organizer.help.4")}</li>
                <li>{t("organizer.help.5")}</li>
              </ul>
            </div>
          </TabPanel>
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}
