import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import { api, type DisplayMatch, type DisplayStanding, type RoundTimer } from "../lib/api";
import { formatMatchScore } from "../lib/matchScore";
import { usePageMeta } from "../hooks/usePageMeta";
import { useRoundTimer } from "../hooks/useRoundTimer";
import { useIntlLocale } from "../lib/formatLocale";

export function EventDisplayPage() {
  const { t } = useTranslation("tournament");
  const locale = useIntlLocale();
  const { id } = useParams();
  const eventId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();

  const [title, setTitle] = useState(() => t("display.loading"));
  const [storeName, setStoreName] = useState("");
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(0);
  const [availableRounds, setAvailableRounds] = useState<number[]>([]);
  const [matches, setMatches] = useState<DisplayMatch[]>([]);
  const [standings, setStandings] = useState<DisplayStanding[]>([]);
  const [roundTimer, setRoundTimer] = useState<RoundTimer | null>(null);
  const [status, setStatus] = useState<string>("ongoing");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paramRound = Number(searchParams.get("round") ?? 0);

  const load = useCallback(async (targetRound?: number) => {
    if (!eventId) return;
    try {
      const data = await api.getEventDisplay(eventId, targetRound || undefined);
      setTitle(data.event.title);
      setStoreName(data.event.storeName);
      setRound(data.round);
      setTotalRounds(data.totalRounds);
      setAvailableRounds(data.availableRounds);
      setMatches(data.matches);
      setStandings(data.standings);
      setRoundTimer(data.timer ?? null);
      setStatus(data.event.status);
      setUpdatedAt(data.updatedAt);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("display.loadFailed"));
    }
  }, [eventId, t]);

  useEffect(() => {
    if (paramRound > 0) void load(paramRound);
    else void load();
  }, [load, paramRound]);

  useEffect(() => {
    if (status !== "ongoing") return;
    const interval = roundTimer?.running ? 5_000 : 15_000;
    const timer = window.setInterval(() => void load(round), interval);
    return () => window.clearInterval(timer);
  }, [load, round, status, roundTimer?.running]);

  usePageMeta({
    title: t("display.metaTitle", { title }),
    description: t("display.metaDesc"),
  });

  const selectRound = (r: number) => {
    setSearchParams(r > 0 ? { round: String(r) } : {});
  };

  const { label: timerLabel, running: timerRunning, expired: timerExpired } = useRoundTimer(roundTimer);

  if (error) {
    return (
      <div className="cc-display cc-display--error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="cc-display">
      <header className="cc-display__header">
        <div>
          <p className="cc-display__store">{storeName}</p>
          <h1 className="cc-display__title">{title}</h1>
        </div>
        <div className="cc-display__header-right">
          {roundTimer && (
            <div
              className={`cc-display__timer${timerRunning ? " cc-display__timer--running" : ""}${timerExpired ? " cc-display__timer--expired" : ""}`}
            >
              <span className="cc-display__timer-label">{t("display.timer")}</span>
              <strong>{timerLabel}</strong>
            </div>
          )}
          <div className="cc-display__round">
            <span className="cc-display__round-label">{t("display.round")}</span>
            <strong>{round}</strong>
            {totalRounds > 0 && <span className="cc-display__round-of">/ {totalRounds}</span>}
            {status === "ongoing" && <span className="cc-display__live">{t("live")}</span>}
          </div>
        </div>
      </header>

      {availableRounds.length > 1 && (
        <div className="cc-display__rounds">
          {availableRounds.map((r) => (
            <button
              key={r}
              type="button"
              className={`cc-display__round-btn${r === round ? " cc-display__round-btn--active" : ""}`}
              onClick={() => selectRound(r)}
            >
              R{r}
            </button>
          ))}
        </div>
      )}

      <div className="cc-display__grid">
        <section className="cc-display__pairings">
          <h2 className="cc-display__section-title">{t("display.pairings")}</h2>
          {matches.length === 0 ? (
            <p className="cc-display__empty">{t("display.empty")}</p>
          ) : (
            <div className="cc-display__table">
              <div className="cc-display__table-head">
                <span>{t("col.table")}</span>
                <span>{t("col.player1")}</span>
                <span />
                <span>{t("col.player2")}</span>
                <span>{t("col.score")}</span>
              </div>
              {matches.map((m) => {
                const score = formatMatchScore(m.p1Games, m.p2Games);
                const pending = m.result === "pending" && !score;
                return (
                  <div
                    key={m.id}
                    className={`cc-display__table-row${pending ? " cc-display__table-row--pending" : " cc-display__table-row--done"}`}
                  >
                    <span className="cc-display__table-num">{m.tableNumber ?? "—"}</span>
                    <span className="cc-display__player">{m.player1}</span>
                    <span className="cc-display__vs">{t("vs")}</span>
                    <span className="cc-display__player">{m.player2}</span>
                    <span className={`cc-display__score${pending ? " cc-display__score--pending" : " cc-display__score--done"}`}>
                      {score ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {standings.length > 0 && (
          <section className="cc-display__standings">
            <h2 className="cc-display__section-title">{t("standings")}</h2>
            <div className="cc-display__table cc-display__table--standings">
              <div className="cc-display__table-head">
                <span>#</span>
                <span>{t("col.player")}</span>
                <span>{t("col.pts")}</span>
                <span>{t("col.recordWld")}</span>
              </div>
              {standings.map((s) => (
                <div key={s.rank} className="cc-display__table-row">
                  <span className="cc-display__rank">{s.rank}</span>
                  <span className="cc-display__player">{s.displayName}</span>
                  <span className="cc-display__pts">{s.points}</span>
                  <span className="cc-display__record">{s.wins}-{s.losses}-{s.draws}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {updatedAt && (
        <footer className="cc-display__footer">
          {t("display.footer", {
            time: new Date(updatedAt).toLocaleTimeString(locale),
          })}
        </footer>
      )}
    </div>
  );
}
