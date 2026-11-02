import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { api, type CoordinatorRequest } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useMediaQuery } from "../hooks/useIsPhone";
import { useToast } from "../hooks/useToast";
import { Page, TabPanel, Tabs } from "../components/Motion";
import { PromptModal } from "../components/Modal";
import { SkeletonCard } from "../components/Skeleton";
import { formatAppDateTime } from "../lib/formatLocale";

type AdminTab = "coordinators" | "events" | "sync" | "news";
type EventRequest = Awaited<ReturnType<typeof api.getEventRequests>>["requests"][number];

/** Compact composition below the same breakpoint where the desktop split collapses. */
const COMPACT_MQ = "(max-width: 980px)";

function CardActions({ compact, onApprove, onReject }: { compact: boolean; onApprove: () => void; onReject: () => void }) {
  const { t } = useTranslation("admin");
  if (compact) {
    return (
      <div className="cc-admin-phone-card__actions">
        <button className="sc-btn" type="button" onClick={onApprove}>
          {t("coord.approve")}
        </button>
        <button className="sc-btn sc-btn--danger" type="button" onClick={onReject}>
          {t("coord.reject")}
        </button>
      </div>
    );
  }
  return (
    <div className="sc-row" style={{ marginTop: "auto", gap: 8 }}>
      <button className="sc-btn sc-btn--sm" type="button" onClick={onApprove}>
        {t("coord.approve")}
      </button>
      <button className="sc-btn sc-btn--danger sc-btn--sm" type="button" onClick={onReject}>
        {t("coord.reject")}
      </button>
    </div>
  );
}

function AdminCoordCard({
  request,
  compact,
  onApprove,
  onReject,
}: {
  request: CoordinatorRequest;
  compact: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation("admin");
  if (compact) {
    return (
      <article className="cc-admin-phone-card" role="listitem">
        <div className="cc-admin-phone-card__body">
          <div className="cc-admin-phone-card__top">
            <span className="cc-admin-phone-card__title">{request.displayName ?? request.username}</span>
          </div>
          <span className="cc-admin-phone-card__meta">{request.email}</span>
          {request.message ? (
            <p className="cc-admin-phone-card__message">{request.message}</p>
          ) : null}
          <span className="cc-admin-phone-card__meta cc-admin-phone-card__meta--soft">
            {t("coord.contact", { info: request.contactInfo })}
          </span>
        </div>
        <CardActions compact onApprove={onApprove} onReject={onReject} />
      </article>
    );
  }

  return (
    <article className="cc-hub-card">
      <h4 className="cc-hub-card__title">{request.displayName ?? request.username}</h4>
      <p className="sc-body-sm">{request.email}</p>
      <p className="sc-body-md">{request.message}</p>
      <p className="sc-micro">{t("coord.contact", { info: request.contactInfo })}</p>
      <CardActions compact={false} onApprove={onApprove} onReject={onReject} />
    </article>
  );
}

function AdminEventCard({
  event,
  compact,
  onApprove,
  onReject,
}: {
  event: EventRequest;
  compact: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation("admin");
  const when = formatAppDateTime(event.startsAt);
  const place = `${event.storeName}${event.city ? ` (${event.city})` : ""}`;

  if (compact) {
    return (
      <article className="cc-admin-phone-card" role="listitem">
        <div className="cc-admin-phone-card__body">
          <div className="cc-admin-phone-card__top">
            <span className="cc-admin-phone-card__title">{event.title}</span>
            <span className="sc-chip sc-chip--gold">{(event.eventType ?? "casual").toUpperCase()}</span>
          </div>
          {event.description ? (
            <p className="cc-admin-phone-card__message">{event.description}</p>
          ) : (
            <span className="cc-admin-phone-card__meta cc-admin-phone-card__meta--soft">{t("events.noDesc")}</span>
          )}
          <span className="cc-admin-phone-card__meta">{when}</span>
          <span className="cc-admin-phone-card__meta cc-admin-phone-card__meta--soft">{place}</span>
        </div>
        <CardActions compact onApprove={onApprove} onReject={onReject} />
      </article>
    );
  }

  return (
    <article className="cc-hub-card">
      <h4 className="cc-hub-card__title">{event.title}</h4>
      <span className="sc-chip sc-chip--gold">{(event.eventType ?? "casual").toUpperCase()}</span>
      <p className="sc-body-md">{event.description ?? t("events.noDescLong")}</p>
      <p className="sc-micro">
        {when} — {place}
      </p>
      <CardActions compact={false} onApprove={onApprove} onReject={onReject} />
    </article>
  );
}

/** Loading / empty / list shell shared by the coordinators and events queues. */
function QueuePanel({
  compact,
  loading,
  title,
  chipClass,
  count,
  emptyText,
  children,
}: {
  compact: boolean;
  loading: boolean;
  title: string;
  chipClass: string;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("admin");

  if (loading) {
    return (
      <div className="sc-stack" style={{ gap: 16 }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (count === 0) {
    return compact ? (
      <div className="cc-admin-phone__empty">
        <p>{emptyText}</p>
      </div>
    ) : (
      <div className="cc-hub-panel">
        <div className="cc-hub-panel__head">
          <h3 className="cc-hub-panel__title">{title}</h3>
          <span className={`sc-chip ${chipClass}`}>{t("coord.pendingZero")}</span>
        </div>
        <p className="sc-body-md">{emptyText}</p>
      </div>
    );
  }

  return compact ? (
    <div className="cc-admin-phone__list" role="list">
      {children}
    </div>
  ) : (
    <div className="cc-hub-panel">
      <div className="cc-hub-panel__head">
        <h3 className="cc-hub-panel__title">{title}</h3>
        <span className={`sc-chip ${chipClass}`}>{t("coord.pending", { count, n: count })}</span>
      </div>
      <div className="cc-hub-grid">{children}</div>
    </div>
  );
}

/** Titled panel shell shared by the sync and news tabs. */
function AdminSection({ compact, title, children }: { compact: boolean; title: string; children: ReactNode }) {
  return (
    <div className={compact ? "cc-admin-phone__panel" : "cc-hub-panel"}>
      {compact ? (
        <h3 className="cc-admin-phone__panel-title">{title}</h3>
      ) : (
        <div className="cc-hub-panel__head">
          <h3 className="cc-hub-panel__title">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

export function AdminPage() {
  const { t } = useTranslation("admin");
  const { user } = useAuth();
  const { toast } = useToast();
  const compact = useMediaQuery(COMPACT_MQ);
  const [tab, setTab] = useState<AdminTab>("coordinators");
  const [requests, setRequests] = useState<CoordinatorRequest[]>([]);
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
  const [syncResult, setSyncResult] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [approveId, setApproveId] = useState<number | null>(null);
  const [storeName, setStoreName] = useState("");

  // Skeletons only on the initial load; refetches after approve/reject update in place.
  const load = () => {
    Promise.all([
      api.getCoordinatorRequests().then((d) => setRequests(d.requests)),
      api.getEventRequests().then((d) => setEventRequests(d.requests)),
    ])
      .catch(() => toast(t("toasts.loadFailed"), "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user]);

  const stats = useMemo(
    () => [
      { label: t("stats.coordQueue"), short: t("stats.coords"), value: requests.length, icon: "ph-users" },
      { label: t("stats.eventApprovals"), short: t("stats.events"), value: eventRequests.length, icon: "ph-calendar-check" },
    ],
    [requests.length, eventRequests.length, t],
  );

  const compactStats = useMemo(
    () => [
      { label: t("stats.coords"), value: requests.length },
      { label: t("stats.events"), value: eventRequests.length },
    ],
    [requests.length, eventRequests.length, t],
  );

  if (!user || user.role !== "admin") {
    return (
      <Page className="cc-admin-page">
        <div className="sc-container cc-section">
          <article className="sc-card cc-admin-phone__denied">
            <p>{t("denied")}</p>
          </article>
        </div>
      </Page>
    );
  }

  const handleReview = async (id: number, action: "approve" | "reject") => {
    if (action === "approve") {
      setApproveId(id);
      return;
    }
    await api.reviewCoordinator(id, "reject");
    toast(t("toasts.rejected"), "success");
    load();
  };

  const handleEventReview = async (id: number, action: "approve" | "reject") => {
    await api.reviewEvent(id, action);
    toast(t(action === "approve" ? "toasts.eventApproved" : "toasts.eventRejected"), "success");
    load();
  };

  const confirmApprove = async () => {
    if (approveId == null) return;
    await api.reviewCoordinator(approveId, "approve", storeName.trim() || undefined);
    toast(t("toasts.approved"), "success");
    setApproveId(null);
    setStoreName("");
    load();
  };

  const handleSync = async () => {
    const data = await api.syncRules();
    setSyncResult(JSON.stringify(data.results));
    toast(t("toasts.synced"), "success");
  };

  const handleNews = async (e: FormEvent) => {
    e.preventDefault();
    await api.createNews({ title: newsTitle, content: newsContent });
    toast(t("toasts.published"), "success");
    setNewsTitle("");
    setNewsContent("");
  };

  const adminTabs = compact
    ? [
        { id: "coordinators" as const, label: t("tabs.coordsShort"), icon: "ph-users" },
        { id: "events" as const, label: t("tabs.eventsShort"), icon: "ph-calendar-check" },
        { id: "sync" as const, label: t("tabs.syncShort"), icon: "ph-arrows-clockwise" },
        { id: "news" as const, label: t("tabs.news"), icon: "ph-newspaper" },
      ]
    : [
        { id: "coordinators" as const, label: t("tabs.coords"), icon: "ph-users" },
        { id: "events" as const, label: t("tabs.events"), icon: "ph-calendar-check" },
        { id: "sync" as const, label: t("tabs.sync"), icon: "ph-arrows-clockwise" },
        { id: "news" as const, label: t("tabs.news"), icon: "ph-newspaper" },
      ];

  return (
    <Page className="cc-admin-page">
      <section className="cc-section cc-admin-hub">
        <div className="sc-container">
          {compact ? (
            <div className="cc-admin-phone__stats" aria-label={t("stats.aria")}>
              {compactStats.map((s) => (
                <div key={s.label} className="cc-admin-phone__stat">
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <header className="cc-hub-header">
              <div className="cc-hub-header__text">
                <span className="sc-chip sc-chip--gold" style={{ marginBottom: 12, display: "inline-flex" }}>
                  <i className="ph ph-shield-check" /> {t("chip")}
                </span>
                <h2 className="sc-headline-lg">{t("title")}</h2>
              </div>
              <div className="cc-hub-stats">
                {stats.map((s) => (
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

          <div className={compact ? "cc-admin-phone" : "cc-page-split"}>
            <aside className={compact ? "cc-admin-phone__nav" : "cc-page-split__aside"}>
              <Tabs
                tabs={adminTabs}
                active={tab}
                onChange={setTab}
                ariaLabel={t("tabs.aria")}
                layout={compact ? "bar" : "sidebar"}
                variant={compact ? "motion" : "spritecraft"}
                className={compact ? "cc-admin-phone__tabs" : ""}
              />
            </aside>

            <div className={compact ? "cc-admin-phone__main" : "cc-page-split__main"}>
              <TabPanel id="coordinators" active={tab === "coordinators"}>
                <QueuePanel
                  compact={compact}
                  loading={loading}
                  title={t("coord.requests")}
                  chipClass="sc-chip--gold"
                  count={requests.length}
                  emptyText={t("coord.empty")}
                >
                  {requests.map((r) => (
                    <AdminCoordCard
                      key={r.id}
                      request={r}
                      compact={compact}
                      onApprove={() => void handleReview(r.id, "approve")}
                      onReject={() => void handleReview(r.id, "reject")}
                    />
                  ))}
                </QueuePanel>
              </TabPanel>

              <TabPanel id="events" active={tab === "events"}>
                <QueuePanel
                  compact={compact}
                  loading={loading}
                  title={t("events.title")}
                  chipClass="sc-chip--cyan"
                  count={eventRequests.length}
                  emptyText={t("events.empty")}
                >
                  {eventRequests.map((ev) => (
                    <AdminEventCard
                      key={ev.id}
                      event={ev}
                      compact={compact}
                      onApprove={() => void handleEventReview(ev.id, "approve")}
                      onReject={() => void handleEventReview(ev.id, "reject")}
                    />
                  ))}
                </QueuePanel>
              </TabPanel>

              <TabPanel id="sync" active={tab === "sync"}>
                <AdminSection compact={compact} title={compact ? t("sync.titleShort") : t("sync.title")}>
                  <p className={compact ? "cc-admin-phone__lede" : "sc-body-md"}>{t("sync.lede")}</p>
                  <button
                    className={`sc-btn sc-btn--secondary${compact ? " sc-btn--lg cc-admin-phone__cta" : ""}`}
                    type="button"
                    onClick={handleSync}
                    style={compact ? undefined : { marginTop: 16 }}
                  >
                    <i className="ph ph-arrows-clockwise" /> {t("sync.now")}
                  </button>
                  {syncResult && (
                    <pre
                      className={`sc-body-sm${compact ? " cc-admin-phone__pre" : ""}`}
                      style={compact ? undefined : { marginTop: 16, whiteSpace: "pre-wrap" }}
                    >
                      {syncResult}
                    </pre>
                  )}
                </AdminSection>
              </TabPanel>

              <TabPanel id="news" active={tab === "news"}>
                <AdminSection compact={compact} title={t("news.title")}>
                  <form className={`cc-form${compact ? " cc-admin-phone__form" : ""}`} onSubmit={handleNews}>
                    <label className="sc-field">
                      <span className="sc-field__label">{t("news.fieldTitle")}</span>
                      <input className="sc-input" value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} required />
                    </label>
                    <label className="sc-field">
                      <span className="sc-field__label">{t("news.fieldContent")}</span>
                      <textarea
                        className="sc-input"
                        rows={compact ? 5 : 6}
                        value={newsContent}
                        onChange={(e) => setNewsContent(e.target.value)}
                        required
                      />
                    </label>
                    <button className={`sc-btn${compact ? " sc-btn--lg cc-admin-phone__cta" : ""}`} type="submit">
                      <i className="ph ph-newspaper" /> {t("news.publish")}
                    </button>
                  </form>
                </AdminSection>
              </TabPanel>
            </div>
          </div>
        </div>
      </section>

      <PromptModal
        open={approveId != null}
        title={t("coord.modalTitle")}
        label={t("coord.storeLabel")}
        value={storeName}
        onChange={setStoreName}
        onConfirm={() => void confirmApprove()}
        onCancel={() => {
          setApproveId(null);
          setStoreName("");
        }}
        confirmLabel={t("coord.approve")}
        required={false}
      />
    </Page>
  );
}
