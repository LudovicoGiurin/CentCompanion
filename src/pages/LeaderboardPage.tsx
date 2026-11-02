import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  api,
  type LeaderboardPlayer,
  type LeaderboardResponse,
} from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useIsPhone } from "../hooks/useIsPhone";
import { formatAppDateTime } from "../lib/formatLocale";
import { FadeIn, Page } from "../components/Motion";
import { SkeletonCard } from "../components/Skeleton";
import { Avatar } from "../components/Avatar";

function rankMedal(rank: number) {
  if (rank === 1) return "sc-chip--gold";
  if (rank === 2) return "sc-chip--cyan";
  if (rank === 3) return "sc-chip--primary";
  return "";
}

function linkedSynced(full: string, href: string) {
  const phrase = "Google Sheets";
  const i = full.indexOf(phrase);
  if (i < 0) return full;
  return (
    <>
      {full.slice(0, i)}
      <a href={href} target="_blank" rel="noreferrer">
        {phrase}
      </a>
      {full.slice(i + phrase.length)}
    </>
  );
}

function PlayerIdentity({
  player,
  size,
}: {
  player: LeaderboardPlayer;
  size: number;
}) {
  const name = player.playerName;
  const inner = (
    <>
      <Avatar
        src={player.claimed ? player.avatarUrl : null}
        name={name}
        frame={player.claimed ? player.equippedFrame : null}
        size={size}
        className="cc-lb-avatar"
      />
      <span className="cc-lb-player__text">
        <strong className="cc-lb-player__name">{name}</strong>
        {player.claimed && player.username && (
          <span className="cc-lb-player__handle">@{player.username}</span>
        )}
      </span>
    </>
  );

  if (player.claimed && player.userId) {
    return (
      <Link to={`/users/${player.userId}`} className="cc-lb-player cc-lb-player--link">
        {inner}
      </Link>
    );
  }

  return <div className="cc-lb-player">{inner}</div>;
}

function PodiumCard({
  player,
  avatarSize,
}: {
  player: LeaderboardPlayer;
  avatarSize: number;
}) {
  const { t } = useTranslation("common");
  const nameChip = (
    <span className={`sc-chip ${rankMedal(player.rank)}`}>
      <h3 className="cc-lb-podium__name">
        #{player.rank} {player.playerName}
      </h3>
    </span>
  );

  const body = (
    <>
      <Avatar
        src={player.claimed ? player.avatarUrl : null}
        name={player.playerName}
        frame={player.claimed ? player.equippedFrame : null}
        size={avatarSize}
        className="cc-lb-avatar cc-lb-podium__avatar"
      />
      {nameChip}
      <p className="cc-lb-podium__pts">{t("leaderboard.pts", { n: player.total })}</p>
    </>
  );

  if (player.claimed && player.userId) {
    return (
      <Link
        to={`/users/${player.userId}`}
        className={`sc-card cc-lb-podium__card cc-lb-podium__card--${player.rank} cc-lb-podium__card--link`}
      >
        {body}
      </Link>
    );
  }

  return (
    <article className={`sc-card cc-lb-podium__card cc-lb-podium__card--${player.rank}`}>
      {body}
    </article>
  );
}

export function LeaderboardPage() {
  const { t } = useTranslation("common");
  const { standing } = useAuth();
  const isPhone = useIsPhone();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getLeaderboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("errors.failedToLoad")))
      .finally(() => setLoading(false));
  }, [t]);

  const players = data?.leaderboard ?? [];

  const myPlayer =
    data?.myStanding ??
    (standing?.rank
      ? {
          rank: standing.rank,
          points: standing.points,
          playerName: standing.playerName ?? "",
        }
      : null);

  const isHighlighted = (player: LeaderboardPlayer) =>
    myPlayer?.playerName &&
    player.playerName.toLowerCase() === myPlayer.playerName.toLowerCase();

  const topThree = players.filter((p) => p.rank <= 3);
  const tablePlayers = players.filter((p) => p.rank > 3);
  const rowAvatarSize = isPhone ? 36 : 40;
  const podiumAvatarSize = isPhone ? 56 : 72;

  return (
    <Page>
      <section className="cc-section">
        <div className="sc-container">
          <div className="cc-h">
            <div>
              <h2 style={{ marginTop: 12 }}>
                {data?.title ?? t("leaderboard.fallbackTitle")}
              </h2>
            </div>
            <div
              className="sc-stack"
              style={{ alignItems: "flex-end", gap: 8 }}
            >
              {myPlayer && (
                <span className="sc-chip sc-chip--gold">
                  {t("leaderboard.yourRank", {
                    rank: myPlayer.rank,
                    points: myPlayer.points,
                  })}
                </span>
              )}
              {data?.sourceUrl && (
                <a
                  href={data.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="sc-micro"
                  style={{ color: "var(--sc-muted)" }}
                >
                  <i className="ph ph-google-logo" /> {t("leaderboard.officialSheet")}
                </a>
              )}
            </div>
          </div>

          {topThree.length > 0 && (
            <FadeIn>
              <div className="cc-lb-podium">
                {topThree.map((p) => (
                  <PodiumCard key={p.rank} player={p} avatarSize={podiumAvatarSize} />
                ))}
              </div>
            </FadeIn>
          )}

          <FadeIn delay={0.1}>
            <article className="sc-card cc-lb-card">
              {loading && <SkeletonCard />}
              {error && <div className="cc-alert cc-alert--error">{error}</div>}

              {!loading && !error && (
                <div className="cc-lb-scroll">
                  <table className="cc-table cc-lb-table">
                    <thead>
                      <tr>
                        <th className="cc-lb-sticky cc-lb-sticky--rank">{t("leaderboard.col.rank")}</th>
                        <th className="cc-lb-sticky cc-lb-sticky--name">
                          {t("leaderboard.col.player")}
                        </th>
                        <th>{t("leaderboard.col.total")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablePlayers.length === 0 ? (
                        <tr className="cc-lb-row--empty">
                          <td colSpan={3}>{t("leaderboard.empty")}</td>
                        </tr>
                      ) : (
                        tablePlayers.map((row) => (
                          <tr
                            key={`${row.rank}-${row.playerName}`}
                            className={
                              isHighlighted(row)
                                ? "cc-lb-row--highlight"
                                : undefined
                            }
                          >
                            <td className="cc-lb-sticky cc-lb-sticky--rank">
                              <span
                                className={`cc-rank ${row.rank <= 3 ? "cc-rank--top" : ""}`}
                              >
                                {row.rank}
                              </span>
                            </td>
                            <td className="cc-lb-sticky cc-lb-sticky--name">
                              <PlayerIdentity player={row} size={rowAvatarSize} />
                            </td>
                            <td className="cc-lb-points">
                              <strong className="cc-lb-total">{row.total}</strong>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {data?.syncedAt && (
                <p
                  className="sc-micro"
                  style={{ marginTop: 16, color: "var(--sc-muted)" }}
                >
                  {data.sourceUrl
                    ? linkedSynced(t("leaderboard.synced", { date: formatAppDateTime(data.syncedAt) }), data.sourceUrl)
                    : t("leaderboard.synced", { date: formatAppDateTime(data.syncedAt) })}
                </p>
              )}
            </article>
          </FadeIn>
        </div>
      </section>
    </Page>
  );
}
