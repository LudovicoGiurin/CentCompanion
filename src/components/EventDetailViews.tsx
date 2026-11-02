import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { EventItem, Registration, RegistrationSummary } from "../lib/api";
import {
  eventStatusChipClass,
  eventStatusLabel,
  eventTypeChipClass,
  eventTypeLabel,
  formatEventDateParts,
} from "../lib/eventDisplay";
import { buildGoogleCalendarUrl, downloadIcsFile, mapsDirectionsUrl } from "../lib/calendar";
import { authReturnUrl, registerReturnUrl } from "../lib/authReturn";
import {
  HoldFightButton,
  SwordSlashOverlay,
  type SignupFightIntent,
} from "./SignupFightOverlay";

type HeroProps = {
  event: EventItem;
  summary: RegistrationSummary | null;
  registrationOpen: boolean;
  isRegistered: boolean;
  onRegister: () => void;
  onTournament: () => void;
  onManage: () => void;
  canManage: boolean;
  showTournament: boolean;
  onCopyLink: () => void | Promise<void>;
};

export function EventDetailHero({
  event,
  summary,
  registrationOpen,
  isRegistered,
  onRegister,
  onTournament,
  onManage,
  canManage,
  showTournament,
  onCopyLink,
}: HeroProps) {
  const { t } = useTranslation("events");
  const date = formatEventDateParts(event.startsAt);
  const confirmed = summary?.confirmedTotal ?? 0;
  const max = event.maxPlayers ?? summary?.maxPlayers ?? null;
  const fillPct = max && max > 0 ? Math.min(100, (confirmed / max) * 100) : null;

  return (
    <header className="cc-event-hero sc-card">
      <div className="cc-event-hero__date" aria-hidden="true">
        <span className="cc-event-hero__weekday">{date.weekday}</span>
        <span className="cc-event-hero__day">{date.day}</span>
        <span className="cc-event-hero__month">{date.month} {date.year}</span>
        <span className="cc-event-hero__time">{date.time}</span>
      </div>

      <div className="cc-event-hero__body">
        <div className="cc-event-hero__badges">
          <span className={`sc-chip ${eventStatusChipClass(event.status)}`}>
            {event.status === "ongoing" && <i className="ph ph-circle cc-dot-live" aria-hidden="true" />}
            {eventStatusLabel(event.status)}
          </span>
          <span className={`sc-chip ${eventTypeChipClass(event.eventType)}`}>
            {eventTypeLabel(event.eventType)}
          </span>
          {event.approvalStatus === "pending_review" && (
            <span className="sc-chip sc-chip--red">{t("hero.pendingApproval")}</span>
          )}
        </div>

        <h1 className="cc-event-hero__title">{event.title}</h1>

        <p className="cc-event-hero__venue">
          <i className="ph ph-storefront" aria-hidden="true" />
          {event.storeName}
          {event.city ? ` · ${event.city}` : ""}
        </p>

        <p className="cc-event-hero__when">
          <i className="ph ph-calendar" aria-hidden="true" />
          {date.weekday} {date.day} {date.month} · {date.time}
          {" · "}
          {max
            ? t("hero.playersOf", { n: confirmed, max })
            : t("hero.players", { count: confirmed, n: confirmed })}
        </p>

        {event.location && (
          <p className="cc-event-hero__location sc-body-sm">
            <i className="ph ph-map-pin" aria-hidden="true" />
            {event.location}
            {" · "}
            <a
              href={mapsDirectionsUrl(event.location, event.city)}
              target="_blank"
              rel="noreferrer"
              className="cc-event-hero__directions"
            >
              {t("hero.directions")}
            </a>
          </p>
        )}

        <div className="cc-event-hero__calendar sc-row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <a
            href={buildGoogleCalendarUrl(event)}
            target="_blank"
            rel="noreferrer"
            className="sc-btn sc-btn--ghost sc-btn--sm"
          >
            <i className="ph ph-calendar-plus" /> {t("hero.googleCalendar")}
          </a>
          <button
            type="button"
            className="sc-btn sc-btn--ghost sc-btn--sm"
            onClick={() => downloadIcsFile(event)}
          >
            <i className="ph ph-download" /> {t("hero.downloadIcs")}
          </button>
        </div>

        <div className="cc-event-hero__actions">
          {registrationOpen && !isRegistered && event.status === "upcoming" && (
            <button className="sc-btn" type="button" onClick={onRegister}>
              <i className="ph ph-ticket" /> {t("hero.register")}
            </button>
          )}
          {isRegistered && event.status === "upcoming" && (
            <button className="sc-btn sc-btn--secondary" type="button" onClick={onRegister}>
              <i className="ph ph-check-circle" /> {t("hero.yourRegistration")}
            </button>
          )}
          {showTournament && (
            <button className="sc-btn sc-btn--secondary" type="button" onClick={onTournament}>
              <i className="ph ph-trophy" /> {event.status === "ongoing" ? t("hero.livePairings") : t("hero.results")}
            </button>
          )}
          {canManage && (
            <button className="sc-btn sc-btn--ghost" type="button" onClick={onManage}>
              <i className="ph ph-gear" /> {t("hero.manage")}
            </button>
          )}
          <button className="sc-btn sc-btn--ghost sc-btn--sm" type="button" onClick={onCopyLink}>
            <i className="ph ph-link" /> {t("hero.share")}
          </button>
        </div>
      </div>

      <aside className="cc-event-hero__aside">
        <div className="cc-event-stat">
          <span className="cc-event-stat__label">{t("hero.stat.players")}</span>
          <strong className="cc-event-stat__value">
            {confirmed}
            {max ? ` / ${max}` : ""}
          </strong>
          <span className="cc-event-stat__hint">{t("hero.stat.confirmed")}</span>
        </div>
        {event.format && (
          <div className="cc-event-stat">
            <span className="cc-event-stat__label">{t("hero.stat.format")}</span>
            <strong className="cc-event-stat__value cc-event-stat__value--sm">{event.format}</strong>
          </div>
        )}
        {fillPct != null && (
          <div className="cc-event-capacity">
            <div className="cc-event-capacity__head">
              <span>{t("hero.capacity")}</span>
              <span>{Math.round(fillPct)}%</span>
            </div>
            <div className="cc-event-capacity__bar">
              <div
                className={`cc-event-capacity__fill${fillPct >= 100 ? " cc-event-capacity__fill--full" : ""}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        )}
      </aside>
    </header>
  );
}

type OverviewProps = {
  event: EventItem;
  registrations: Registration[];
  summary: RegistrationSummary | null;
  registrationOpen: boolean;
  registration: Registration | null;
  guestRegistration: Registration | null;
  canManage?: boolean;
  onRegister: () => void;
  /** Logged-in users only — cancel own registration while upcoming */
  onLeave?: () => void;
  /** When signup gate already shows title/venue/date, skip those tiles */
  skipSummaryFacts?: boolean;
};

function DetailTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="cc-event-tile">
      <i className={`ph ${icon}`} aria-hidden="true" />
      <div>
        <span className="cc-event-tile__label">{label}</span>
        <span className="cc-event-tile__value">{value}</span>
        {hint && <span className="cc-event-tile__hint">{hint}</span>}
      </div>
    </div>
  );
}

export function EventOverviewPanel({
  event,
  registrations,
  summary,
  registrationOpen,
  registration,
  guestRegistration,
  canManage = false,
  onRegister,
  onLeave,
  skipSummaryFacts = false,
}: OverviewProps) {
  const { t } = useTranslation("events");
  const date = formatEventDateParts(event.startsAt);
  const confirmed = registrations.filter((r) => r.registrationStatus === "confirmed");
  const waitlisted = registrations.filter((r) => r.registrationStatus === "waitlisted");
  const rosterPreview = confirmed.slice(0, 10);
  const rosterExtra = confirmed.length - rosterPreview.length;

  const userReg = registration ?? guestRegistration;
  const showCompanionCode = Boolean(event.companionEventCode && (userReg || canManage));
  const teaseCompanionCode = Boolean(
    !showCompanionCode && (event.companionEventCode || event.hasCompanionEventCode),
  );
  const hasExtraDetails =
    !skipSummaryFacts ||
    !!event.location ||
    !!event.organizerName ||
    !!event.format ||
    !!event.registrationDeadline;

  return (
    <div className="cc-event-overview">
      {userReg && (
        <article className="sc-card cc-event-your-status">
          <div className="cc-event-your-status__head">
            <i className="ph ph-user-check" aria-hidden="true" />
            <div>
              <strong>{userReg.registrationStatus === "waitlisted" ? t("overview.youreWaitlisted") : t("overview.youreRegistered")}</strong>
              <span className="sc-body-sm">
                {guestRegistration && !registration
                  ? t("overview.guestClaim")
                  : userReg.deckName || t("overview.noDeck")}
              </span>
            </div>
            <span
              className={`sc-chip ${userReg.registrationStatus === "confirmed" ? "sc-chip--primary" : "sc-chip--gold"}`}
            >
              {userReg.registrationStatus}
            </span>
          </div>
          {event.status === "upcoming" && (
            <div className="sc-row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="sc-btn sc-btn--sm sc-btn--secondary" type="button" onClick={onRegister}>
                {registration ? t("overview.editDecklist") : t("overview.viewReservation")}
              </button>
              {onLeave && registration && (
                <button className="sc-btn sc-btn--sm sc-btn--danger" type="button" onClick={onLeave}>
                  {t("overview.leave")}
                </button>
              )}
            </div>
          )}
        </article>
      )}

      {showCompanionCode && (
        <article className="sc-card cc-join-code-card">
          <h2 className="cc-event-section__title">{t("overview.companion.title")}</h2>
          <p className="sc-body-sm">
            {t("overview.companion.body")}
          </p>
          <div className="cc-join-code-card__row">
            <span className="cc-join-code-card__code">{event.companionEventCode}</span>
          </div>
        </article>
      )}

      {teaseCompanionCode && (
        <article className="sc-card cc-join-code-card">
          <h2 className="cc-event-section__title">{t("overview.companion.title")}</h2>
          <p className="sc-body-sm">
            {t("overview.companion.tease")}
          </p>
          {registrationOpen && (
            <button className="sc-btn sc-btn--sm" type="button" onClick={onRegister}>
              {t("overview.companion.register")}
            </button>
          )}
        </article>
      )}

      <div className="cc-event-overview__grid">
        <article className="sc-card cc-event-overview__main">
          {event.description ? (
            <section className="cc-event-section">
              <h2 className="cc-event-section__title">{t("overview.about")}</h2>
              <p className="cc-event-description">{event.description}</p>
            </section>
          ) : (
            <section className="cc-event-section">
              <h2 className="cc-event-section__title">{t("overview.about")}</h2>
              <p className="sc-body-sm cc-event-description--empty">
                {t("overview.noDescription")}
              </p>
            </section>
          )}

          {hasExtraDetails && (
            <section className="cc-event-section">
              <h2 className="cc-event-section__title">{skipSummaryFacts ? t("overview.moreDetails") : t("overview.details")}</h2>
              <div className="cc-event-tiles">
                {!skipSummaryFacts && (
                  <DetailTile icon="ph-calendar" label={t("overview.tile.date")} value={date.long} hint={date.time} />
                )}
                {!skipSummaryFacts && (
                  <DetailTile icon="ph-storefront" label={t("overview.tile.store")} value={event.storeName} />
                )}
                {event.location && (
                  <DetailTile icon="ph-map-pin" label={t("overview.tile.location")} value={event.location} hint={event.city ?? undefined} />
                )}
                {event.organizerName && event.organizerId ? (
                  <DetailTile
                    icon="ph-user"
                    label={t("overview.tile.organizer")}
                    value={<Link to={`/organizers/${event.organizerId}`}>{event.organizerName}</Link>}
                  />
                ) : event.organizerName ? (
                  <DetailTile icon="ph-user" label={t("overview.tile.organizer")} value={event.organizerName} />
                ) : null}
                {event.format && <DetailTile icon="ph-game-controller" label={t("overview.tile.format")} value={event.format} />}
                {event.registrationDeadline && (
                  <DetailTile
                    icon="ph-hourglass"
                    label={t("overview.tile.closes")}
                    value={formatEventDateParts(event.registrationDeadline).long}
                    hint={formatEventDateParts(event.registrationDeadline).time}
                  />
                )}
                {event.allowGuestRegistration && registrationOpen && !skipSummaryFacts && (
                  <DetailTile
                    icon="ph-ticket"
                    label={t("overview.tile.guest")}
                    value={t("overview.tile.allowed")}
                    hint={t("overview.tile.guestHint")}
                  />
                )}
              </div>
            </section>
          )}
        </article>

        <aside className="cc-event-overview__side">
          <article className="sc-card">
            <h2 className="cc-event-section__title">{t("overview.reg.title")}</h2>
            <ul className="cc-event-reg-stats">
              <li>
                <span>{t("overview.reg.confirmed")}</span>
                <strong>{summary?.confirmedTotal ?? confirmed.length}</strong>
              </li>
              <li>
                <span>{t("overview.reg.members")}</span>
                <strong>{summary?.confirmedMembers ?? "—"}</strong>
              </li>
              {(summary?.confirmedGuests ?? 0) > 0 && (
                <li>
                  <span>{t("overview.reg.guests")}</span>
                  <strong>{summary?.confirmedGuests}</strong>
                </li>
              )}
              {(summary?.waitlisted ?? waitlisted.length) > 0 && (
                <li>
                  <span>{t("overview.reg.waitlisted")}</span>
                  <strong>{summary?.waitlisted ?? waitlisted.length}</strong>
                </li>
              )}
            </ul>
            {registrationOpen && !userReg && (
              <button className="sc-btn sc-btn--secondary" type="button" onClick={onRegister} style={{ width: "100%", marginTop: 12 }}>
                <i className="ph ph-ticket" /> {t("overview.reg.signUp")}
              </button>
            )}
          </article>

          {confirmed.length > 0 && (
            <article className="sc-card">
              <h2 className="cc-event-section__title">
                {t("overview.players", { n: confirmed.length })}
              </h2>
              <ul className="cc-event-roster">
                {rosterPreview.map((r) => (
                  <li key={r.id} className="cc-event-roster__item">
                    <span className="cc-event-roster__name">{r.displayName}</span>
                    {r.isGuest && <span className="sc-chip sc-chip--gold sc-chip--xs">{t("overview.guestChip")}</span>}
                    {r.moxfieldUrl && (
                      <a
                        href={r.moxfieldUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="cc-event-roster__deck"
                        title={t("overview.viewDeck")}
                      >
                        <i className="ph ph-link" aria-hidden="true" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {rosterExtra > 0 && (
                <p className="sc-body-sm" style={{ marginTop: 8 }}>{t("overview.more", { n: rosterExtra })}</p>
              )}
            </article>
          )}

          {!registrationOpen && event.status === "upcoming" && (
            <article className="sc-card cc-event-note">
              <i className="ph ph-lock" aria-hidden="true" />
              <p>{t("overview.closed")}</p>
            </article>
          )}
        </aside>
      </div>
    </div>
  );
}

export function EventSignupGate({
  event,
  summary,
  allowGuest,
  onLogin,
  onGuest,
  onCreateAccount,
  member,
}: {
  event: EventItem;
  summary: RegistrationSummary | null;
  allowGuest: boolean;
  onLogin: () => void;
  onGuest: () => void;
  onCreateAccount: () => void;
  /** Logged-in phone signup — hold Register now */
  member?: {
    name: string;
    busy?: boolean;
    decklistRequired?: boolean;
    onRegister: () => void;
    claimable?: { onClaim: () => void } | null;
  } | null;
}) {
  const { t } = useTranslation("events");
  const { t: tc } = useTranslation("common");
  const date = formatEventDateParts(event.startsAt);
  const confirmed = summary?.confirmedTotal ?? 0;
  const max = event.maxPlayers ?? summary?.maxPlayers ?? null;
  const [holdingIntent, setHoldingIntent] = useState<SignupFightIntent | null>(null);
  const [slashIntent, setSlashIntent] = useState<SignupFightIntent | null>(null);
  const slashIntentRef = useRef(slashIntent);
  slashIntentRef.current = slashIntent;
  const isMember = Boolean(member);

  const finish = useCallback(
    (intent: SignupFightIntent) => {
      setHoldingIntent(null);
      setSlashIntent(null);
      if (intent === "login") onLogin();
      else if (intent === "guest") onGuest();
      else if (intent === "register" && member) member.onRegister();
      else onCreateAccount();
    },
    [member, onCreateAccount, onGuest, onLogin],
  );

  const onHoldComplete = useCallback((intent: SignupFightIntent) => {
    setHoldingIntent(null);
    setSlashIntent(intent);
  }, []);

  const onSlashDone = useCallback(() => {
    const intent = slashIntentRef.current;
    if (intent) finish(intent);
  }, [finish]);

  return (
    <article className="sc-card cc-signup-gate" id="cc-signup-gate">
      <p className="cc-signup-gate__eyebrow">{t("signup.eyebrow")}</p>
      <div className="cc-signup-gate__badges">
        <span className={`sc-chip ${eventStatusChipClass(event.status)}`}>
          {eventStatusLabel(event.status)}
        </span>
        <span className={`sc-chip ${eventTypeChipClass(event.eventType)}`}>
          {eventTypeLabel(event.eventType)}
        </span>
      </div>
      <h2 className="cc-signup-gate__title">{event.title}</h2>
      <p className="cc-signup-gate__meta">
        {event.storeName}
        {event.city ? ` · ${event.city}` : ""}
      </p>
      <p className="cc-signup-gate__meta">
        {date.weekday} {date.day} {date.month} · {date.time}
        {" · "}
        {max
          ? t("signup.spotsOf", { n: confirmed, max })
          : t("signup.spots", { count: confirmed, n: confirmed })}
      </p>

      {isMember && member?.claimable && (
        <div className="cc-alert cc-alert--success" style={{ marginTop: 12 }}>
          <p>{t("signup.claimFound", { name: member.name })}</p>
          <button className="sc-btn sc-btn--sm" type="button" onClick={member.claimable.onClaim} style={{ marginTop: 8 }}>
            {t("signup.claim")}
          </button>
        </div>
      )}

      <div className="cc-signup-gate__actions">
        {isMember && member ? (
          <>
            <p className="sc-body-sm cc-signup-gate__member-lede">{t("signup.registerAs", { name: member.name })}</p>
            <HoldFightButton
              intent="register"
              label={member.busy ? t("signup.registering") : t("signup.registerNow")}
              hint={member.decklistRequired ? t("signup.holdContinue") : t("signup.holdRegister")}
              variant="primary"
              disabled={member.busy}
              activeIntent={holdingIntent}
              onHoldStart={setHoldingIntent}
              onHoldCancel={() => setHoldingIntent(null)}
              onHoldComplete={onHoldComplete}
            />
            <p className="cc-signup-gate__hint sc-body-sm">
              {member.decklistRequired
                ? t("signup.holdDecklistNext")
                : t("signup.holdOptional")}
            </p>
          </>
        ) : (
          <>
            <HoldFightButton
              intent="login"
              label={tc("nav.logIn")}
              variant="primary"
              activeIntent={holdingIntent}
              onHoldStart={setHoldingIntent}
              onHoldCancel={() => setHoldingIntent(null)}
              onHoldComplete={onHoldComplete}
            />
            <p className="cc-signup-gate__or" aria-hidden>
              {t("signup.or")}
            </p>
            {allowGuest ? (
              <HoldFightButton
                intent="guest"
                label={t("signup.continueGuest")}
                variant="ghost"
                activeIntent={holdingIntent}
                onHoldStart={setHoldingIntent}
                onHoldCancel={() => setHoldingIntent(null)}
                onHoldComplete={onHoldComplete}
              />
            ) : (
              <HoldFightButton
                intent="register"
                label={t("signup.createAccount")}
                hint={t("signup.holdCreate")}
                variant="ghost"
                activeIntent={holdingIntent}
                onHoldStart={setHoldingIntent}
                onHoldCancel={() => setHoldingIntent(null)}
                onHoldComplete={onHoldComplete}
              />
            )}
            <p className="cc-signup-gate__hint sc-body-sm">
              {t("signup.holdHint")}
              {allowGuest ? ` ${t("signup.priorityHint")}` : ` ${t("signup.accountRequired")}`}
            </p>
          </>
        )}
      </div>

      <SwordSlashOverlay open={slashIntent != null} onDone={onSlashDone} />
    </article>
  );
}

/** @deprecated Prefer EventSignupGate — kept for any leftover call sites */
export function RegistrationChoiceCards({
  allowGuest,
  onGuest,
  returnPath,
}: {
  allowGuest: boolean;
  onGuest: () => void;
  returnPath: string;
}) {
  const { t } = useTranslation("events");
  const { t: tc } = useTranslation("common");
  return (
    <div className="cc-reg-choice">
      <Link to={authReturnUrl(returnPath)} className="sc-btn sc-btn--lg cc-reg-choice__primary">
        <i className="ph ph-sign-in" aria-hidden="true" />
        {tc("nav.logIn")}
      </Link>
      {allowGuest && (
        <button type="button" className="sc-btn sc-btn--ghost sc-btn--lg cc-reg-choice__secondary" onClick={onGuest}>
          <i className="ph ph-ticket" aria-hidden="true" />
          {t("signup.continueGuest")}
        </button>
      )}
      <Link to={registerReturnUrl(returnPath)} className="cc-reg-choice__link">
        {t("signup.createAccount")}
      </Link>
      <p className="cc-reg-choice__hint sc-body-sm">
        {allowGuest
          ? t("signup.choice.priority")
          : t("signup.accountRequired")}
      </p>
    </div>
  );
}

type StickyCtaProps = {
  event: EventItem;
  registrationOpen: boolean;
  isRegistered: boolean;
  myMatchLabel?: string | null;
  onRegister: () => void;
  onTournament: () => void;
  showTournament: boolean;
};

export function EventStickyCta({
  event,
  registrationOpen,
  isRegistered,
  myMatchLabel,
  onRegister,
  onTournament,
  showTournament,
}: StickyCtaProps) {
  const { t } = useTranslation("events");
  const showRegister = registrationOpen && !isRegistered && event.status === "upcoming";
  const showYourReg = isRegistered && event.status === "upcoming";
  const showLive = showTournament && (event.status === "ongoing" || !!myMatchLabel);

  if (!showRegister && !showYourReg && !showLive) return null;

  return (
    <div className="cc-event-sticky-cta" role="region" aria-label={t("sticky.aria")}>
      {myMatchLabel && event.status === "ongoing" && (
        <span className="cc-event-sticky-cta__label">{myMatchLabel}</span>
      )}
      <div className="cc-event-sticky-cta__actions">
        {showRegister && (
          <button className="sc-btn cc-event-sticky-cta__primary" type="button" onClick={onRegister}>
            <i className="ph ph-ticket" aria-hidden="true" />
            {t("signup.registerNow")}
          </button>
        )}
        {showYourReg && (
          <button className="sc-btn sc-btn--secondary cc-event-sticky-cta__primary" type="button" onClick={onRegister}>
            <i className="ph ph-check-circle" aria-hidden="true" />
            {t("hero.yourRegistration")}
          </button>
        )}
        {showLive && !showRegister && !showYourReg && (
          <button className="sc-btn sc-btn--secondary cc-event-sticky-cta__primary" type="button" onClick={onTournament}>
            {event.status === "ongoing" ? t("hero.livePairings") : t("hero.results")}
          </button>
        )}
        {showLive && (showRegister || showYourReg) && (
          <button className="sc-btn sc-btn--ghost sc-btn--sm" type="button" onClick={onTournament}>
            {event.status === "ongoing" ? t("sticky.pairings") : t("hero.results")}
          </button>
        )}
      </div>
    </div>
  );
}
