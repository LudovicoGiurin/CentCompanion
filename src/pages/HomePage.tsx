import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type EventItem, type NewsPost, formatUserName } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { formatAppDate } from "../lib/formatLocale";
import { FadeIn, Page } from "../components/Motion";
import { HomeIntro } from "../components/HomeIntro";

export function HomePage() {
  const { t } = useTranslation(["common"]);
  const { user, standing } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [posts, setPosts] = useState<NewsPost[]>([]);

  useEffect(() => {
    api
      .getEvents()
      .then((d) => setEvents(d.events))
      .catch(() => {});
    api
      .getNews()
      .then((d) => setPosts(d.posts.slice(0, 3)))
      .catch(() => {});
  }, []);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    const allowedTypes = new Set(
      user ? ["local_league", "lv1", "lv2"] : ["lv1", "lv2"],
    );

    return events
      .filter(
        (ev) =>
          (!ev.approvalStatus || ev.approvalStatus === "approved") &&
          ev.status !== "cancelled" &&
          ev.status !== "completed" &&
          new Date(ev.startsAt).getTime() >= now &&
          !!ev.eventType &&
          allowedTypes.has(ev.eventType),
      )
      .sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
      .slice(0, 3);
  }, [events, user]);

  return (
    <Page className="cc-home">
      <HomeIntro />
      <section className="cc-section cc-section--hero">
        <div className="sc-container">
          <div className="cc-hero__grid">
            <div className="cc-hero">
              <h1 className="cc-home__title">
                <span className="cc-home__title-brand">{t("home.headline.line1")}</span>
                <span className="cc-home__title-app">{t("home.headline.line2")}</span>
              </h1>
              <div className="cc-hero__actions">
                <Link to="/events" className="sc-btn sc-btn--lg">
                  <i className="ph ph-calendar-star" aria-hidden="true" />
                  {t("home.cta.events")}
                </Link>
              </div>
            </div>
          </div>

          {user ? (
            <div className="cc-home__phone-panel">
              <Link to="/profile" className="cc-home__phone-panel__card">
                <div className="cc-home__phone-panel__top">
                  <span className="cc-home__phone-panel__name">
                    {formatUserName(user)}
                  </span>
                </div>
                <div className="cc-home__phone-panel__stats">
                  <span>
                    <strong>{standing?.points ?? 0}</strong> {t("home.phone.pts")}
                  </span>
                  <span>
                    <strong>{standing?.eventsPlayed ?? 0}</strong> {t("home.phone.events")}
                  </span>
                  <span>
                    {t("home.hud.record", {
                      w: standing?.wins ?? 0,
                      l: standing?.losses ?? 0,
                    })}
                  </span>
                </div>
                <span className="cc-home__phone-panel__go">
                  {t("home.phone.openProfile")}
                  <i className="ph ph-caret-right" aria-hidden="true" />
                </span>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="cc-section cc-home__section">
        <div className="sc-container">
          <div className="cc-h">
            <h2>
              <span className="cc-home__title-desktop">{t("home.upcoming.desktop")}</span>
              <span className="cc-home__title-phone">{t("home.upcoming.phone")}</span>
            </h2>
            <Link to="/events" className="sc-btn sc-btn--ghost sc-btn--sm">
              {t("home.viewAll")}
            </Link>
          </div>

          <div className="cc-grid-3 cc-home__desktop-grid">
            {upcomingEvents.length === 0 ? (
              <article className="sc-card cc-event-card cc-home__empty">
                <p>{t("home.noEvents")}</p>
              </article>
            ) : (
              upcomingEvents.map((ev, i) => (
                <FadeIn key={ev.id} delay={i * 0.08}>
                  <article className="sc-card cc-event-card">
                    <div className="cc-event-card__hd">
                      <i className="ph ph-storefront" aria-hidden="true" />
                      <h3>{ev.title}</h3>
                    </div>
                    <p>
                      {ev.storeName} — {formatAppDate(ev.startsAt)}
                    </p>
                    <div className="cc-event-card__meta">
                      <span>
                        <i className="ph ph-users" /> {ev.format}
                      </span>
                      <Link
                        to={`/events/${ev.id}`}
                        className="sc-chip sc-chip--primary"
                      >
                        {t("home.details")}
                      </Link>
                    </div>
                  </article>
                </FadeIn>
              ))
            )}
          </div>
        </div>

        <div className="cc-home-rail" aria-label={t("home.rail.aria")}>
          {upcomingEvents.length === 0 ? (
            <article className="sc-card cc-event-card cc-home-rail__empty">
              <p>{t("home.noEventsShort")}</p>
            </article>
          ) : (
            upcomingEvents.map((ev) => (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className="sc-card cc-event-card cc-home-rail__card"
              >
                <div className="cc-event-card__hd">
                  <i className="ph ph-storefront" aria-hidden="true" />
                  <h3>{ev.title}</h3>
                </div>
                <p>
                  {ev.storeName}
                  <br />
                  {formatAppDate(ev.startsAt)}
                </p>
                <div className="cc-event-card__meta">
                  <span>
                    <i className="ph ph-users" /> {ev.format}
                  </span>
                  <span className="sc-chip sc-chip--primary">{t("home.open")}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="cc-section cc-home__section">
        <div className="sc-container">
          <div className="cc-h">
            <h2>
              <span className="cc-home__title-desktop">{t("home.news.desktop")}</span>
              <span className="cc-home__title-phone">{t("home.news.phone")}</span>
            </h2>
          </div>

          <div className="cc-grid-3 cc-home__desktop-grid">
            {posts.length === 0 ? (
              <article className="sc-card cc-home__empty">
                <p className="sc-body-md">{t("home.news.empty")}</p>
              </article>
            ) : (
              posts.map((post, i) => (
                <FadeIn key={post.id} delay={i * 0.08}>
                  <article className="sc-card cc-event-card">
                    <h3 className="sc-card__title">{post.title}</h3>
                    <p>{post.excerpt ?? post.content.slice(0, 120)}…</p>
                    <div className="cc-event-card__meta">
                      <span>{post.authorName ?? t("home.news.staff")}</span>
                      <span>{formatAppDate(post.createdAt)}</span>
                    </div>
                  </article>
                </FadeIn>
              ))
            )}
          </div>

          <div className="cc-home-news">
            {posts.length === 0 ? (
              <article className="sc-card cc-home__empty">
                <p className="sc-body-md">{t("home.news.emptyShort")}</p>
              </article>
            ) : (
              posts.map((post) => (
                <article key={post.id} className="sc-card cc-home-news__card">
                  <h3 className="sc-card__title">{post.title}</h3>
                  <p>
                    {(post.excerpt ?? post.content).slice(0, 90)}
                    {(post.excerpt ?? post.content).length > 90 ? "…" : ""}
                  </p>
                  <div className="cc-event-card__meta">
                    <span>{post.authorName ?? t("home.news.staff")}</span>
                    <span>{formatAppDate(post.createdAt)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </Page>
  );
}
