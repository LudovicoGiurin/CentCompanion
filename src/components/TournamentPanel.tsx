import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { AuthUser, EventItem, MatchItem, RoundTimer, TournamentStanding } from "../lib/api";
import { useIsPhone } from "../hooks/useIsPhone";
import { formatMatchScore, myMatchScore, parseBo3Score } from "../lib/matchScore";
import { Tabs } from "./Motion";
import { RoundTimerBanner } from "./RoundTimerControl";

type ReportPayload = { p1Games: number; p2Games: number } | { result: string };

type Props = {
  event: EventItem;
  user: AuthUser | null;
  registration: boolean;
  matches: MatchItem[];
  standings: TournamentStanding[];
  round: number;
  totalRounds: number;
  availableRounds: number[];
  currentRound: number;
  isLiveRound: boolean;
  isOrganizerView: boolean;
  pairingBusy: boolean;
  roundTimer?: RoundTimer | null;
  phaseKind?: "swiss" | "top_cut";
  onRoundChange: (round: number) => void;
  onReportResult: (matchId: number, payload: ReportPayload) => Promise<void>;
};

function opponentName(match: MatchItem, userId: number, byeLabel: string): string {
  if (match.player2 === "BYE") return byeLabel;
  return match.player1Id === userId ? match.player2 : match.player1;
}

function MatchScoreForm({
  leftLabel,
  rightLabel,
  busy,
  disabled,
  fullWidth,
  compact,
  initialLeft,
  initialRight,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  leftLabel: string;
  rightLabel: string;
  busy: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  initialLeft?: number | null;
  initialRight?: number | null;
  submitLabel?: string;
  onSubmit: (p1Games: number, p2Games: number) => Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation("tournament");
  const [left, setLeft] = useState(String(initialLeft ?? 0));
  const [right, setRight] = useState(String(initialRight ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const locked = disabled || busy || submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = parseBo3Score(Number(left), Number(right));
    if (!parsed.ok) {
      setError(t("score.invalid"));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(parsed.p1Games, parsed.p2Games);
    } finally {
      setSubmitting(false);
    }
  };

  const label = submitLabel ?? (compact ? t("score.save") : t("score.submit"));

  return (
    <form
      className={`cc-match-score${fullWidth ? " cc-match-score--phone" : ""}${compact ? " cc-match-score--compact" : ""}`}
      onSubmit={handleSubmit}
    >
      <div className="cc-match-score__row">
        <label className="cc-match-score__field">
          {!compact && <span className="cc-match-score__label">{leftLabel}</span>}
          <select
            className="sc-input cc-match-score__select"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            disabled={locked}
            aria-label={leftLabel}
          >
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <span className="cc-match-score__sep">–</span>
        <label className="cc-match-score__field">
          {!compact && <span className="cc-match-score__label">{rightLabel}</span>}
          <select
            className="sc-input cc-match-score__select"
            value={right}
            onChange={(e) => setRight(e.target.value)}
            disabled={locked}
            aria-label={rightLabel}
          >
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <button
          type="submit"
          className={`sc-btn sc-btn--sm cc-match-score__submit${fullWidth ? " cc-match-score__submit--phone" : ""}${submitting ? " cc-match-score__submit--busy" : ""}`}
          disabled={locked}
          aria-busy={submitting}
          aria-live="polite"
        >
          {submitting && (
            <i className="ph ph-circle-notch cc-match-score__spinner" aria-hidden />
          )}
          <span className="cc-match-score__submit-label">{label}</span>
        </button>
        {onCancel && (
          <button
            type="button"
            className="sc-btn sc-btn--ghost sc-btn--sm cc-match-score__cancel"
            disabled={locked}
            onClick={onCancel}
            aria-label={t("score.cancel")}
            title={t("score.cancel")}
          >
            <i className="ph ph-x" aria-hidden />
          </button>
        )}
      </div>
      {error && <p className="cc-match-score__error">{error}</p>}
    </form>
  );
}

function OrganizerMatchResult({
  match,
  busy,
  disabled,
  onReportResult,
}: {
  match: MatchItem;
  busy: boolean;
  disabled?: boolean;
  onReportResult: (matchId: number, payload: ReportPayload) => Promise<void>;
}) {
  const { t } = useTranslation("tournament");
  const score = formatMatchScore(match.p1Games, match.p2Games);
  const isBye = match.player2 === "BYE";
  const [editing, setEditing] = useState(false);

  if (isBye) {
    return <span className="sc-chip sc-chip--gold">{t("result.bye")}</span>;
  }

  if (match.result === "pending" || editing) {
    return (
      <MatchScoreForm
        leftLabel="P1"
        rightLabel="P2"
        busy={busy}
        disabled={disabled}
        compact
        initialLeft={editing ? (match.p1Games ?? 0) : 0}
        initialRight={editing ? (match.p2Games ?? 0) : 0}
        submitLabel={editing ? t("score.update") : undefined}
        onCancel={editing ? () => setEditing(false) : undefined}
        onSubmit={async (p1Games, p2Games) => {
          await onReportResult(match.id, { p1Games, p2Games });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="cc-organizer-result">
      <span className="cc-pairing-table__score cc-pairing-table__score--done">{score}</span>
      <button
        type="button"
        className="sc-btn sc-btn--ghost sc-btn--sm cc-organizer-result__edit"
        disabled={busy || disabled}
        onClick={() => setEditing(true)}
      >
        {t("score.edit")}
      </button>
    </div>
  );
}

function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="cc-tournament__section">
      <button type="button" className="cc-tournament__section-toggle" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <i className={`ph ${open ? "ph-caret-up" : "ph-caret-down"}`} aria-hidden />
      </button>
      {open && <div className="cc-tournament__section-body">{children}</div>}
    </div>
  );
}

function StandingsTable({
  standings,
  userId,
}: {
  standings: TournamentStanding[];
  userId?: number;
}) {
  const { t } = useTranslation("tournament");
  return (
    <div className="cc-table-scroll">
      <div className="cc-standings__table">
        <div className="cc-standings__head">
          <span>#</span>
          <span>{t("col.player")}</span>
          <span>{t("col.pts")}</span>
          <span>{t("col.w")}</span>
          <span>{t("col.l")}</span>
          <span>{t("col.d")}</span>
          <span>{t("col.omw")}</span>
        </div>
        {standings.map((s) => (
          <div
            key={s.userId}
            className={`cc-standings__row${userId === s.userId ? " cc-standings__row--mine" : ""}`}
          >
            <span>{s.rank}</span>
            <span>{s.displayName}</span>
            <span>{s.points}</span>
            <span>{s.wins}</span>
            <span>{s.losses}</span>
            <span>{s.draws}</span>
            <span>{s.omw.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StandingsPhone({
  standings,
  userId,
}: {
  standings: TournamentStanding[];
  userId?: number;
}) {
  const { t } = useTranslation("tournament");
  return (
    <ul className="cc-standings-phone" role="list">
      {standings.map((s) => (
        <li
          key={s.userId}
          className={`cc-standings-phone__row${userId === s.userId ? " cc-standings-phone__row--mine" : ""}`}
        >
          <span className="cc-standings-phone__rank">{s.rank}</span>
          <div className="cc-standings-phone__body">
            <div className="cc-standings-phone__top">
              <span className="cc-standings-phone__name">{s.displayName}</span>
              <strong className="cc-standings-phone__pts">
                {s.points} {t("col.pts")}
              </strong>
            </div>
            <span className="cc-standings-phone__meta">
              {s.wins}-{s.losses}-{s.draws} · {t("col.omw")} {s.omw.toFixed(1)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PairingsCards({
  matches,
  userId,
  organizer = false,
  isLiveRound = false,
  pairingBusy = false,
  onReportResult,
}: {
  matches: MatchItem[];
  userId?: number;
  organizer?: boolean;
  isLiveRound?: boolean;
  pairingBusy?: boolean;
  onReportResult?: (matchId: number, payload: ReportPayload) => Promise<void>;
}) {
  const { t } = useTranslation("tournament");
  return (
    <ul className="cc-pairing-cards" role="list">
      {matches.map((m, index) => {
        const isMine = !!(userId && (m.player1Id === userId || m.player2Id === userId));
        const score = formatMatchScore(m.p1Games, m.p2Games);
        const isBye = m.player2 === "BYE";
        const pending = m.result === "pending" && !score;
        return (
          <li
            key={m.id}
            className={`cc-pairing-card${isMine ? " cc-pairing-card--mine" : ""}${index % 2 === 1 ? " cc-pairing-card--alt" : ""}${pending ? " cc-pairing-card--pending" : ""}`}
          >
            <div className="cc-pairing-card__meta">
              <span className="cc-pairing-card__table">
                {t("col.table")} {m.tableNumber ?? "—"}
              </span>
              {!organizer && (
                <span className={`cc-pairing-card__score${pending ? " cc-pairing-card__score--pending" : " cc-pairing-card__score--done"}`}>
                  {score ?? (pending ? "—" : "")}
                </span>
              )}
              {organizer && isBye && <span className="sc-chip sc-chip--gold">{t("result.bye")}</span>}
            </div>
            <div className="cc-pairing-card__players">
              <span className="cc-pairing-card__player">{m.player1}</span>
              <span className="cc-pairing-card__vs">{t("vs")}</span>
              <span className="cc-pairing-card__player">{m.player2}</span>
            </div>
            {organizer && onReportResult && !isBye && (
              <div className="cc-pairing-card__report">
                <OrganizerMatchResult
                  match={m}
                  busy={pairingBusy}
                  disabled={!isLiveRound && m.result === "pending"}
                  onReportResult={onReportResult}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PlayerMatchCard({
  match,
  userId,
  isLiveRound,
  busy,
  phone,
  onReport,
}: {
  match: MatchItem;
  userId: number;
  isLiveRound: boolean;
  busy: boolean;
  phone?: boolean;
  onReport: (payload: ReportPayload) => Promise<void>;
}) {
  const { t } = useTranslation("tournament");
  const isBye = match.player2 === "BYE";
  const byeLabel = t("result.bye");
  const score = myMatchScore(match.p1Games, match.p2Games, userId, match.player1Id);
  let resultLabel: string | null = null;
  if (match.result !== "pending") {
    if (match.result === "draw") {
      resultLabel = score ? t("result.drawScore", { score }) : t("result.draw");
    } else if (match.result === "p1_win") {
      const won = match.player1Id === userId;
      resultLabel = score
        ? won
          ? t("result.wonScore", { score })
          : t("result.lostScore", { score })
        : won
          ? t("result.won")
          : t("result.lost");
    } else if (match.result === "p2_win") {
      const won = match.player2Id === userId;
      resultLabel = score
        ? won
          ? t("result.wonScore", { score })
          : t("result.lostScore", { score })
        : won
          ? t("result.won")
          : t("result.lost");
    }
  }
  const canReport = isLiveRound && match.result === "pending" && !isBye;
  const isP1 = match.player1Id === userId;

  return (
    <div className="cc-player-match">
      <div className="cc-player-match__table">
        <span className="cc-player-match__table-label">{t("myTable")}</span>
        <strong className="cc-player-match__table-num">{match.tableNumber ?? "—"}</strong>
      </div>

      <div className="cc-player-match__opponent">
        <span className="cc-player-match__vs-label">{isBye ? t("round") : t("opponent")}</span>
        <strong>{opponentName(match, userId, byeLabel)}</strong>
      </div>

      {resultLabel && (
        <div
          className={`cc-player-match__result cc-player-match__result--${
            match.result === "draw"
              ? "draw"
              : (match.result === "p1_win" && match.player1Id === userId) ||
                  (match.result === "p2_win" && match.player2Id === userId)
                ? "win"
                : "loss"
          }`}
        >
          <i
            className={`ph ${
              match.result === "draw"
                ? "ph-equals"
                : (match.result === "p1_win" && match.player1Id === userId) ||
                    (match.result === "p2_win" && match.player2Id === userId)
                  ? "ph-trophy"
                  : "ph-x"
            }`}
          />
          <span>{resultLabel}</span>
          {match.reportedByName && match.reportedBy !== userId && (
            <span className="cc-player-match__reported">
              {t("reportedBy", { name: match.reportedByName })}
            </span>
          )}
        </div>
      )}

      {canReport && (
        <div className="cc-player-match__report">
          <p className="cc-player-match__report-hint">{t("enterScore")}</p>
          <MatchScoreForm
            leftLabel={t("score.you")}
            rightLabel={opponentName(match, userId, byeLabel)}
            busy={busy}
            fullWidth={phone}
            onSubmit={async (p1Games, p2Games) => {
              await onReport(
                isP1 ? { p1Games, p2Games } : { p1Games: p2Games, p2Games: p1Games },
              );
            }}
          />
        </div>
      )}

      {isLiveRound && match.result !== "pending" && !isBye && (
        <p className="sc-body-sm cc-player-match__done">{t("resultRecorded")}</p>
      )}
    </div>
  );
}

export function TournamentPanel({
  event,
  user,
  registration,
  matches,
  standings,
  round,
  totalRounds,
  availableRounds,
  currentRound,
  isLiveRound,
  isOrganizerView,
  pairingBusy,
  roundTimer,
  phaseKind = "swiss",
  onRoundChange,
  onReportResult,
}: Props) {
  const { t } = useTranslation("tournament");
  const { t: tc } = useTranslation("common");
  const isPhone = useIsPhone();
  const myMatch =
    user && round === currentRound
      ? matches.find((m) => m.player1Id === user.id || m.player2Id === user.id)
      : undefined;

  const showPlayerHero = !!user && !!registration && event.status === "ongoing" && round === currentRound;
  const pendingCount = matches.filter((m) => m.result === "pending" && m.player2 !== "BYE").length;
  const resolvedCount = matches.length - pendingCount;
  const phaseLabel = phaseKind === "top_cut" ? t("phase.topCut") : t("phase.swiss");

  const standingsView = isPhone ? (
    <StandingsPhone standings={standings} userId={user?.id} />
  ) : (
    <StandingsTable standings={standings} userId={user?.id} />
  );

  const pairingsView = (organizer: boolean) =>
    isPhone ? (
      <PairingsCards
        matches={matches}
        userId={user?.id}
        organizer={organizer}
        isLiveRound={isLiveRound}
        pairingBusy={pairingBusy}
        onReportResult={organizer ? onReportResult : undefined}
      />
    ) : (
      <PairingsTable
        matches={matches}
        userId={user?.id}
        organizer={organizer}
        isLiveRound={isLiveRound}
        pairingBusy={pairingBusy}
        onReportResult={organizer ? onReportResult : undefined}
      />
    );

  return (
    <div className={`cc-tournament sc-card${isPhone ? " cc-tournament--phone" : ""}`}>
      {event.status === "ongoing" && round === currentRound && roundTimer && (
        <RoundTimerBanner timer={roundTimer} />
      )}

      <div className="cc-tournament__header">
        <div>
          <div className="cc-tournament__title-row">
            <h3 className="sc-card__title">
              {t("roundTitle", { phase: phaseLabel, n: round })}
            </h3>
            {event.status === "ongoing" && round === currentRound && (
              <span className="cc-tournament__live-badge">{t("live")}</span>
            )}
          </div>
          {totalRounds > 0 && (
            <p className="cc-tournament__subtitle">
              {t("roundOf", { n: round, total: totalRounds })}
              {event.status === "completed" && ` ${t("completeSuffix")}`}
            </p>
          )}
        </div>
      </div>

      {!user && event.status === "ongoing" && (
        <div className="cc-tournament__signin-prompt">
          <p className="sc-body-sm">
            <Link to={`/login?return=${encodeURIComponent(`/events/${event.id}?tab=tournament`)}`}>
              {tc("nav.logIn")}
            </Link>{" "}
            {t("signInPromptAfter")}
          </p>
        </div>
      )}

      {user && !registration && event.status !== "completed" && (
        <div className="cc-tournament__signin-prompt">
          <p className="sc-body-sm">{t("notRegistered")}</p>
        </div>
      )}

      {showPlayerHero && myMatch && (
        <PlayerMatchCard
          match={myMatch}
          userId={user.id}
          isLiveRound={isLiveRound}
          busy={pairingBusy}
          phone={isPhone}
          onReport={(payload) => onReportResult(myMatch.id, payload)}
        />
      )}

      {isOrganizerView && isLiveRound && matches.length > 0 && (
        <div className="cc-result-progress">
          <div className="cc-result-progress__head">
            <span>{t("resultsEntered")}</span>
            <span>{resolvedCount} / {matches.length}</span>
          </div>
          <div className="cc-result-progress__bar">
            <div
              className="cc-result-progress__fill"
              style={{ width: `${matches.length ? (resolvedCount / matches.length) * 100 : 0}%` }}
            />
          </div>
          {pendingCount > 0 && (
            <p className="sc-body-sm">{t("pendingBeforeEnd", { count: pendingCount, n: pendingCount })}</p>
          )}
        </div>
      )}

      {availableRounds.length > 1 && (
        <Tabs
          tabs={availableRounds.map((r) => ({
            id: String(r),
            label: `R${r}`,
          }))}
          active={String(round)}
          onChange={(r) => onRoundChange(Number(r))}
          ariaLabel={t("roundSelector")}
          className="cc-round-tabs"
        />
      )}

      {!isOrganizerView ? (
        <>
          {matches.length === 0 ? (
            <p className="cc-tournament__empty">{t("empty.pairings")}</p>
          ) : (
            <Collapsible title={t("allPairings")} defaultOpen={!myMatch}>
              {pairingsView(false)}
            </Collapsible>
          )}
          {standings.length > 0 && (
            <Collapsible title={t("standings")} defaultOpen>
              {standingsView}
            </Collapsible>
          )}
        </>
      ) : (
        <>
          {matches.length === 0 ? (
            <p className="cc-tournament__empty">{t("empty.pairingsOrg")}</p>
          ) : (
            pairingsView(true)
          )}
          {standings.length > 0 && (
            <div className="cc-standings">
              <h4 className="sc-headline-md">{t("standings")}</h4>
              {standingsView}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PairingsTable({
  matches,
  userId,
  organizer = false,
  isLiveRound = false,
  pairingBusy = false,
  onReportResult,
}: {
  matches: MatchItem[];
  userId?: number;
  organizer?: boolean;
  isLiveRound?: boolean;
  pairingBusy?: boolean;
  onReportResult?: (matchId: number, payload: ReportPayload) => Promise<void>;
}) {
  const { t } = useTranslation("tournament");
  return (
    <div className="cc-table-scroll">
      <div className="cc-pairing-table">
        <div className={`cc-pairing-table__head${organizer ? " cc-pairing-table__head--organizer" : ""}`}>
          <span>{t("col.table")}</span>
          <span>{t("col.player1")}</span>
          <span />
          <span>{t("col.player2")}</span>
          {!organizer && <span>{t("col.score")}</span>}
          {organizer && <span>{t("col.result")}</span>}
        </div>
        {matches.map((m) => {
          const isMine = userId && (m.player1Id === userId || m.player2Id === userId);
          const score = formatMatchScore(m.p1Games, m.p2Games);
          const pending = m.result === "pending" && !score;
          return (
            <div
              key={m.id}
              className={`cc-pairing-table__row${isMine ? " cc-pairing-table__row--mine" : ""}${organizer ? " cc-pairing-table__row--organizer" : ""}${pending ? " cc-pairing-table__row--pending" : ""}`}
            >
              <span className="cc-pairing-table__table">{m.tableNumber ?? "—"}</span>
              <span className="cc-pairing-table__player">{m.player1}</span>
              <span className="cc-pairing-table__vs">{t("vs")}</span>
              <span className="cc-pairing-table__player">{m.player2}</span>
              {!organizer && (
                <span className={`cc-pairing-table__score${pending ? " cc-pairing-table__score--pending" : " cc-pairing-table__score--done"}`}>
                  {score ?? (pending ? "—" : "")}
                </span>
              )}
              {organizer && onReportResult && (
                <div className="cc-pairing-table__result">
                  <OrganizerMatchResult
                    match={m}
                    busy={pairingBusy}
                    disabled={!isLiveRound && m.result === "pending"}
                    onReportResult={onReportResult}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
