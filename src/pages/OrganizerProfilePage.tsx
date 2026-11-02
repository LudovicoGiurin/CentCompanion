import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { api, type EventItem } from "../lib/api";
import { Page } from "../components/Motion";
import { formatAppDateTime } from "../lib/formatLocale";
import { eventStatusLabel } from "../lib/eventDisplay";

export function OrganizerProfilePage() {
  const { t } = useTranslation("common");
  const { id } = useParams();
  const organizerId = Number(id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [organizer, setOrganizer] = useState<{
    displayName: string;
    storeName: string | null;
    localLeagueCity: string | null;
    username: string;
  } | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    if (!organizerId) return;
    setLoading(true);
    api
      .getOrganizerProfile(organizerId)
      .then((data) => {
        setOrganizer(data.organizer);
        setEvents(data.events);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("errors.failedToLoad")))
      .finally(() => setLoading(false));
  }, [organizerId, t]);

  return (
    <Page>
      {loading ? (
        <p className="sc-body-sm">{t("actions.loading")}</p>
      ) : error || !organizer ? (
        <article className="sc-card">
          <h1 className="sc-headline-md">{t("organizerProfile.notFound")}</h1>
          <p className="sc-body-sm">{error || t("organizerProfile.notPublic")}</p>
          <Link to="/events">{t("actions.browseEvents")}</Link>
        </article>
      ) : (
        <div className="sc-stack" style={{ gap: 16 }}>
          <article className="sc-card">
            <h1 className="sc-headline-lg">{organizer.displayName}</h1>
            <p className="sc-body-sm">@{organizer.username}</p>
            {organizer.storeName && <p className="sc-body-md">{organizer.storeName}</p>}
            {organizer.localLeagueCity && (
              <p className="sc-body-sm">{t("organizerProfile.localLeague", { city: organizer.localLeagueCity })}</p>
            )}
          </article>
          <article className="sc-card">
            <h2 className="sc-headline-md">{t("organizerProfile.events")}</h2>
            {events.length === 0 ? (
              <p className="sc-body-sm">{t("organizerProfile.noEvents")}</p>
            ) : (
              <ul className="sc-stack" style={{ gap: 8, listStyle: "none", padding: 0 }}>
                {events.map((ev) => (
                  <li key={ev.id}>
                    <Link to={`/events/${ev.id}`}>{ev.title}</Link>
                    <span className="sc-body-sm">
                      {" "}
                      · {formatAppDateTime(ev.startsAt)} · {eventStatusLabel(ev.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      )}
    </Page>
  );
}
