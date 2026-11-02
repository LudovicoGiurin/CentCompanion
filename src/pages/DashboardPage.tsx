import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type EventItem } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useIsPhone } from "../hooks/useIsPhone";
import { Page } from "../components/Motion";
import { SkeletonCard } from "../components/Skeleton";
import { Modal } from "../components/Modal";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useToast } from "../hooks/useToast";
import { PRIVACY_CONTACT_EMAIL } from "../lib/legal";
import { GibboGuide } from "../components/GibboGuide";
import { ProfileCard } from "../components/ProfileCard";
import { getDashboardGibboSteps, consumeGibboReplay, requestGibboReplay, shouldShowGibboDashboard } from "../lib/gibbo";
import {
  eventStatusChipClass,
  eventStatusLabel,
  eventTypeLabel,
  formatEventDateParts,
} from "../lib/eventDisplay";

function DashEventRow({
  event,
  to,
  meta,
}: {
  event: EventItem;
  to: string;
  meta?: string;
}) {
  const date = formatEventDateParts(event.startsAt);
  return (
    <Link to={to} className="cc-profile-row" role="listitem">
      <div className="cc-profile-row__body">
        <div className="cc-profile-row__top">
          <span className="cc-profile-row__title">{event.title}</span>
          <span className={`sc-chip ${eventStatusChipClass(event.status)}`}>
            {eventStatusLabel(event.status)}
          </span>
        </div>
        <span className="cc-profile-row__meta">
          {date.weekday} {date.day} {date.month} · {date.time}
        </span>
        <span className="cc-profile-row__meta cc-profile-row__meta--soft">
          {meta ?? `${event.storeName}${event.city ? ` · ${event.city}` : ""}`}
        </span>
      </div>
      <i className="ph ph-caret-right cc-profile-row__chevron" aria-hidden="true" />
    </Link>
  );
}

export function DashboardPage() {
  const { t } = useTranslation(["dashboard", "common", "events"]);
  const { user, standing, loading } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [gibboOpen, setGibboOpen] = useState(false);
  const gibboSteps = useMemo(() => getDashboardGibboSteps(), [t]);

  useEffect(() => {
    api
      .getEvents()
      .then((d) => setEvents(d.events))
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (!shouldShowGibboDashboard()) return;

    const t = window.setTimeout(() => {
      consumeGibboReplay();
      setGibboOpen(true);
    }, 400);
    return () => window.clearTimeout(t);
  }, [user, loading]);

  const registeredEvents = useMemo(
    () => events.filter((ev) => ev.isRegistered && ev.status !== "cancelled"),
    [events],
  );

  const organizingEvents = useMemo(
    () =>
      user
        ? events.filter((ev) => ev.organizerId === user.id && ev.status !== "cancelled")
        : [],
    [events, user],
  );

  const liveEvent = useMemo(
    () => events.find((ev) => ev.isRegistered && ev.status === "ongoing"),
    [events],
  );

  const isOrganizer = user?.role === "coordinator" || user?.role === "admin";

  if (loading) {
    return (
      <>
        {user ? (
          <GibboGuide steps={gibboSteps} open={gibboOpen} onClose={() => setGibboOpen(false)} />
        ) : null}
        <Page>
          <div className="sc-container cc-section">
            <SkeletonCard />
          </div>
        </Page>
      </>
    );
  }

  if (!user) {
    return (
      <Page className="cc-dashboard-page">
        <div className="sc-container cc-section">
          <article className="sc-card cc-dashboard-guest">
            <h1 className="cc-dashboard-guest__title">{t("guest.title")}</h1>
            <div className="cc-dashboard-guest__actions">
              <Link to="/login?return=/profile" className="sc-btn sc-btn--lg">
                {t("common:nav.logIn")}
              </Link>
              <Link to="/register?return=/profile" className="sc-btn sc-btn--ghost sc-btn--lg">
                {t("guest.create")}
              </Link>
            </div>
          </article>
        </div>
      </Page>
    );
  }

  return (
    <>
      <GibboGuide steps={gibboSteps} open={gibboOpen} onClose={() => setGibboOpen(false)} />
      <Page className="cc-dashboard-page">
        <section className="cc-section cc-dashboard">
          <div className="sc-container cc-profile-page">
            <ProfileCard user={user} standing={standing} />

            {liveEvent && (
              <Link to={`/events/${liveEvent.id}?tab=tournament`} className="cc-profile-live">
                <span className="cc-profile-live__label">{t("liveNow")}</span>
                <strong>{liveEvent.title}</strong>
                <span className="cc-profile-live__go">
                  {t("pairings")}
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </span>
              </Link>
            )}

            {!user.localLeagueCity && (
              <Link to="/settings" className="cc-profile-nudge">
                <i className="ph ph-map-pin" aria-hidden="true" />
                <span>{t("nudge.city")}</span>
                <i className="ph ph-caret-right" aria-hidden="true" />
              </Link>
            )}

            <section className="sc-card cc-profile-section" data-gibbo="my-events">
              <div className="cc-profile-section__head">
                <h2>{t("profile.nextEvents")}</h2>
                <Link to="/events" className="cc-profile-section__link">
                  {t("browse")}
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </Link>
              </div>
              {loadingEvents ? (
                <p className="cc-profile-empty">{t("common:actions.loading")}</p>
              ) : registeredEvents.length === 0 ? (
                <div className="cc-profile-empty">
                  <p>{t("profile.noEvents")}</p>
                  <Link to="/events" className="sc-btn sc-btn--sm">
                    <i className="ph ph-compass" aria-hidden="true" /> {t("profile.discover")}
                  </Link>
                </div>
              ) : (
                <div className="cc-profile-list" role="list">
                  {registeredEvents.slice(0, 5).map((ev) => (
                    <DashEventRow
                      key={ev.id}
                      event={ev}
                      to={`/events/${ev.id}?tab=register`}
                      meta={`${eventTypeLabel(ev.eventType)} · ${ev.storeName}`}
                    />
                  ))}
                </div>
              )}
            </section>

            {isOrganizer && (
              <section className="sc-card cc-profile-section">
                <div className="cc-profile-section__head">
                  <h2>{t("profile.organizing", { count: organizingEvents.length })}</h2>
                  <Link to="/organizer" className="cc-profile-section__link">
                    {t("hub")}
                    <i className="ph ph-caret-right" aria-hidden="true" />
                  </Link>
                </div>
                {organizingEvents.length === 0 ? (
                  <p className="cc-profile-empty">
                    {t("noEventsYet")} <Link to="/organizer?tab=create">{t("createOne")}</Link>
                  </p>
                ) : (
                  <div className="cc-profile-list" role="list">
                    {organizingEvents.slice(0, 3).map((ev) => (
                      <DashEventRow
                        key={ev.id}
                        event={ev}
                        to={`/events/${ev.id}?tab=manage`}
                        meta={`${eventTypeLabel(ev.eventType)} · ${t("manage")}`}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </section>
      </Page>
    </>
  );
}

export function SettingsPage() {
  const { t } = useTranslation(["dashboard", "auth", "common", "legal"]);
  const { user, refresh, loading, logout } = useAuth();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profileMessage, setProfileMessage] = useState("");
  const [coordinatorStatus, setCoordinatorStatus] = useState("");
  const [coordinatorError, setCoordinatorError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [privacyMessage, setPrivacyMessage] = useState("");
  const [privacyError, setPrivacyError] = useState("");
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [contactInfo, setContactInfo] = useState("");
  const [coordinatorMessage, setCoordinatorMessage] = useState("");
  const [localLeagueCity, setLocalLeagueCity] = useState(user?.localLeagueCity ?? "");
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login?return=/settings", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    setLocalLeagueCity(user.localLeagueCity ?? "");
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
  }, [user]);

  const handleCoordinatorApply = async (e: FormEvent) => {
    e.preventDefault();
    setCoordinatorError("");
    setCoordinatorStatus("");
    try {
      await api.applyCoordinator(coordinatorMessage, contactInfo);
      setCoordinatorStatus(t("settings.coordinator.success"));
    } catch (err) {
      setCoordinatorError(err instanceof Error ? err.message : t("settings.coordinator.failed"));
    }
  };

  const handlePreferences = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.updatePreferences({ localLeagueCity, firstName, lastName });
      await refresh();
      setProfileMessage(t("settings.profileUpdated"));
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : t("settings.profileFailed"));
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordMismatch"));
      return;
    }
    setPasswordBusy(true);
    try {
      const data = await api.changePassword(currentPassword, newPassword);
      setPasswordMessage(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t("settings.passwordFailed"));
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setPrivacyMessage("");
    setPrivacyError("");
    setPrivacyBusy(true);
    try {
      const blob = await api.exportMyData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cent-companion-data-${user.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPrivacyMessage(t("settings.exportDone"));
    } catch (err) {
      setPrivacyError(err instanceof Error ? err.message : t("settings.exportFailed"));
    } finally {
      setPrivacyBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    setDeleteBusy(true);
    try {
      const data = await api.deleteAccount(deletePassword);
      setDeleteOpen(false);
      logout();
      toast(data.message, "success");
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("settings.delete.failed"));
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading || !user) return null;

  const profileForm = (
    <form className="cc-form" onSubmit={handlePreferences}>
      <div className={isPhone ? "cc-settings-phone__stack" : "cc-grid-2"}>
        <label className="sc-field">
          <span className="sc-field__label">{t("auth:register.firstName")}</span>
          <input className="sc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
        </label>
        <label className="sc-field">
          <span className="sc-field__label">{t("auth:register.lastName")}</span>
          <input className="sc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
        </label>
      </div>
      <label className="sc-field">
        <span className="sc-field__label">{t("settings.cityLabel")}</span>
        <input className="sc-input" value={localLeagueCity} onChange={(e) => setLocalLeagueCity(e.target.value)} placeholder={t("settings.cityPh")} />
      </label>
      <button className={`sc-btn sc-btn--secondary${isPhone ? " cc-settings-phone__cta" : ""}`} type="submit">
        <i className="ph ph-floppy-disk" aria-hidden="true" /> {t("settings.saveProfile")}
      </button>
    </form>
  );

  const passwordForm = (
    <form className="cc-form" onSubmit={handleChangePassword}>
      <label className="sc-field">
        <span className="sc-field__label">{t("settings.currentPassword")}</span>
        <input
          className="sc-input"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={passwordBusy}
        />
      </label>
      <label className="sc-field">
        <span className="sc-field__label">{t("settings.newPassword")}</span>
        <input
          className="sc-input"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={passwordBusy}
        />
      </label>
      <label className="sc-field">
        <span className="sc-field__label">{t("settings.confirmNew")}</span>
        <input
          className="sc-input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={passwordBusy}
        />
      </label>
      <button
        className={`sc-btn sc-btn--secondary${isPhone ? " cc-settings-phone__cta" : ""}`}
        type="submit"
        disabled={passwordBusy}
      >
        {passwordBusy ? t("settings.saving") : t("settings.updatePassword")}
      </button>
    </form>
  );

  const coordinatorForm = (
    <form className="cc-form" onSubmit={handleCoordinatorApply}>
      <label className="sc-field">
        <span className="sc-field__label">{t("settings.coordinator.why")}</span>
        <textarea
          className="sc-input"
          rows={4}
          required
          value={coordinatorMessage}
          onChange={(e) => setCoordinatorMessage(e.target.value)}
        />
      </label>
      <label className="sc-field">
        <span className="sc-field__label">{t("settings.coordinator.contact")}</span>
        <input className="sc-input" required value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
      </label>
      <button className={`sc-btn sc-btn--secondary${isPhone ? " cc-settings-phone__cta" : ""}`} type="submit">
        <i className="ph ph-paper-plane" aria-hidden="true" /> {t("settings.coordinator.submit")}
      </button>
    </form>
  );

  return (
    <Page className="cc-settings-page">
      <section className="cc-section cc-settings">
        <div className="sc-container cc-settings__container">
          {isPhone ? (
            <div className="cc-settings-phone">
              <article className="sc-card cc-settings-phone__card">
                {profileMessage && <div className="cc-alert cc-alert--success">{profileMessage}</div>}
                {profileForm}
              </article>

              <article className="sc-card cc-settings-phone__card">
                {passwordError && <div className="cc-alert cc-alert--error">{passwordError}</div>}
                {passwordMessage && <div className="cc-alert cc-alert--success">{passwordMessage}</div>}
                {passwordForm}
                <p className="cc-settings-phone__link-row">
                  <Link to="/forgot-password">{t("auth:login.forgot")}</Link>
                </p>
              </article>

              <article className="sc-card cc-settings-phone__card">
                <LanguageSwitcher variant="settings" />
                <button
                  className="sc-btn sc-btn--secondary cc-settings-phone__cta"
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    requestGibboReplay();
                    navigate("/profile");
                  }}
                >
                  <i className="ph ph-magic-wand" aria-hidden="true" /> {t("settings.meetGibbo")}
                </button>
              </article>

              <article className="sc-card cc-settings-phone__card">
                {privacyError && <div className="cc-alert cc-alert--error">{privacyError}</div>}
                {privacyMessage && <div className="cc-alert cc-alert--success">{privacyMessage}</div>}
                <button
                  className="sc-btn sc-btn--secondary cc-settings-phone__cta"
                  type="button"
                  disabled={privacyBusy}
                  onClick={() => void handleExportData()}
                >
                  <i className="ph ph-download" aria-hidden="true" />{" "}
                  {privacyBusy ? t("settings.preparing") : t("settings.download")}
                </button>
                <p className="cc-settings-phone__link-row">
                  <Link to="/privacy">{t("legal:privacy.title")}</Link>
                </p>
              </article>

              {user.role === "user" && (
                <article className="sc-card cc-settings-phone__card">
                  {coordinatorError && <div className="cc-alert cc-alert--error">{coordinatorError}</div>}
                  {coordinatorStatus && <div className="cc-alert cc-alert--success">{coordinatorStatus}</div>}
                  {coordinatorForm}
                </article>
              )}

              {user.role !== "admin" && (
                <article className="sc-card cc-settings-danger cc-settings-phone__card">
                  <button
                    className="sc-btn sc-btn--danger cc-settings-phone__cta"
                    type="button"
                    onClick={() => {
                      setDeleteOpen(true);
                      setDeletePassword("");
                      setDeleteError("");
                    }}
                  >
                    <i className="ph ph-trash" aria-hidden="true" /> {t("settings.delete.title")}
                  </button>
                </article>
              )}
            </div>
          ) : (
            <>
              <h2 className="sc-headline-lg">{t("settings.title")}</h2>
              <article className="sc-card" style={{ marginTop: 24 }}>
                <p>
                  <strong>{t("settings.email")}</strong> {user.email}
                </p>
                <p>
                  <strong>{t("settings.username")}</strong> {user.username}
                </p>
                <p>
                  <strong>{t("settings.role")}</strong> <span className="sc-chip sc-chip--primary">{user.role}</span>
                </p>
                <p>
                  <strong>{t("settings.cityLabel")}:</strong> {user.localLeagueCity ?? t("settings.cityNotSet")}
                </p>
              </article>

              <article className="sc-card" style={{ marginTop: 24 }}>
                <h3 className="sc-card__title">{t("settings.profile")}</h3>
                {profileMessage && <div className="cc-alert cc-alert--success">{profileMessage}</div>}
                {profileForm}
              </article>

              <article className="sc-card" style={{ marginTop: 24 }}>
                <h3 className="sc-card__title">{t("settings.changePassword")}</h3>
                <p className="sc-body-sm">
                  <Link to="/forgot-password">{t("settings.resetViaEmail")}</Link>
                </p>
                {passwordError && <div className="cc-alert cc-alert--error">{passwordError}</div>}
                {passwordMessage && <div className="cc-alert cc-alert--success">{passwordMessage}</div>}
                {passwordForm}
              </article>

              <article className="sc-card" style={{ marginTop: 24 }}>
                <h3 className="sc-card__title">{t("settings.help")}</h3>
                <p className="sc-body-sm">{t("settings.gibboHelp")}</p>
                <LanguageSwitcher variant="settings" />
                <button
                  className="sc-btn sc-btn--secondary sc-btn--sm"
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    requestGibboReplay();
                    navigate("/profile");
                  }}
                >
                  <i className="ph ph-magic-wand" /> {t("settings.meetGibbo")}
                </button>
              </article>

              <article className="sc-card" style={{ marginTop: 24 }}>
                <h3 className="sc-card__title">{t("settings.privacy")}</h3>
                <p className="sc-body-sm">{t("settings.privacyBody", { email: PRIVACY_CONTACT_EMAIL })}</p>
                {privacyError && <div className="cc-alert cc-alert--error">{privacyError}</div>}
                {privacyMessage && <div className="cc-alert cc-alert--success">{privacyMessage}</div>}
                <div className="sc-row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    className="sc-btn sc-btn--secondary sc-btn--sm"
                    type="button"
                    disabled={privacyBusy}
                    onClick={() => void handleExportData()}
                  >
                    <i className="ph ph-download" /> {t("settings.download")}
                  </button>
                </div>
              </article>

              {user.role !== "admin" && (
                <article className="sc-card cc-settings-danger" style={{ marginTop: 24 }}>
                  <h3 className="sc-card__title">{t("settings.delete.title")}</h3>
                  <p className="sc-body-sm">{t("settings.delete.body")}</p>
                  <button
                    className="sc-btn sc-btn--danger sc-btn--sm"
                    type="button"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      setDeleteOpen(true);
                      setDeletePassword("");
                      setDeleteError("");
                    }}
                  >
                    <i className="ph ph-trash" /> {t("settings.delete.title")}
                  </button>
                </article>
              )}

              {user.role === "user" && (
                <article className="sc-card" style={{ marginTop: 24 }}>
                  <h3 className="sc-card__title">{t("settings.coordinator.title")}</h3>
                  <p className="sc-body-md">{t("settings.coordinator.lede")}</p>
                  {coordinatorError && <div className="cc-alert cc-alert--error">{coordinatorError}</div>}
                  {coordinatorStatus && <div className="cc-alert cc-alert--success">{coordinatorStatus}</div>}
                  {coordinatorForm}
                </article>
              )}
            </>
          )}
        </div>
      </section>

      {deleteOpen && (
        <Modal
          open
          title={t("settings.delete.confirmTitle")}
          confirmLabel={t("settings.delete.confirmLabel")}
          confirmVariant="danger"
          busy={deleteBusy}
          confirmDisabled={!deletePassword}
          onConfirm={() => void handleDeleteAccount()}
          onCancel={() => setDeleteOpen(false)}
        >
          <p>{t("settings.delete.confirmBody")}</p>
          {deleteError && <div className="cc-alert cc-alert--error">{deleteError}</div>}
          <label className="sc-field" style={{ marginTop: 12 }}>
            <span className="sc-field__label">{t("settings.delete.password")}</span>
            <input
              className="sc-input"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        </Modal>
      )}
    </Page>
  );
}


