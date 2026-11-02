import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CompanionRegistrationOption, CompanionStandingRow } from "../lib/api";
import { isValidMoxfieldUrl, moxfieldHint } from "../lib/moxfield";
import { formatAppDateTime } from "../lib/formatLocale";

type Props = {
  standings: CompanionStandingRow[];
  registrations?: CompanionRegistrationOption[];
  companionEventCode: string | null;
  companionLastPulledAt: string | null;
  isOrganizer: boolean;
  busy?: boolean;
  onUpdateMoxfield?: (registrationId: number, moxfieldUrl: string) => Promise<void>;
  onRemap?: (
    links: { standingId: number; registrationId: number | null }[],
  ) => Promise<void>;
};

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function playerName(row: CompanionStandingRow): string {
  return row.displayName || `${row.firstName} ${row.lastName}`.trim();
}

function standingsToCsv(standings: CompanionStandingRow[]): string {
  const header = ["Rank", "Player", "Wins", "Losses", "Draws", "Points", "OMW%", "GW%", "Deck", "Moxfield"];
  const lines = standings.map((row) =>
    [
      row.rank,
      playerName(row),
      row.wins,
      row.losses,
      row.draws,
      row.matchPoints,
      row.opponentMatchWinPercent == null ? "" : (row.opponentMatchWinPercent * 100).toFixed(1),
      row.gameWinPercent == null ? "" : (row.gameWinPercent * 100).toFixed(1),
      row.deckName ?? "",
      row.moxfieldUrl ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadStandingsCsv(standings: CompanionStandingRow[], eventCode: string | null) {
  const csv = standingsToCsv(standings);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `companion-standings${eventCode ? `-${eventCode}` : ""}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CompanionResultsReport({
  standings,
  registrations = [],
  companionEventCode,
  companionLastPulledAt,
  isOrganizer,
  busy = false,
  onUpdateMoxfield,
  onRemap,
}: Props) {
  const { t } = useTranslation("events");
  const { t: tc } = useTranslation("common");
  const { t: tt } = useTranslation("tournament");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [remapping, setRemapping] = useState(false);
  const [draftLinks, setDraftLinks] = useState<Record<number, number | "">>({});
  const [remapError, setRemapError] = useState("");
  const [remapBusy, setRemapBusy] = useState(false);

  useEffect(() => {
    if (!remapping) return;
    const next: Record<number, number | ""> = {};
    for (const row of standings) {
      next[row.id] = row.registrationId ?? "";
    }
    setDraftLinks(next);
    setRemapError("");
  }, [remapping, standings]);

  const unmatchedCount = standings.filter((s) => !s.matched).length;

  const usedRegIds = useMemo(() => {
    const used = new Set<number>();
    for (const value of Object.values(draftLinks)) {
      if (typeof value === "number") used.add(value);
    }
    return used;
  }, [draftLinks]);

  if (!standings.length) {
    return (
      <article className="sc-card">
        <h3 className="sc-headline-md">{t("companion.results.title")}</h3>
        <p className="sc-body-sm">
          {isOrganizer ? t("companion.results.emptyOrg") : t("companion.results.emptyPlayer")}
        </p>
      </article>
    );
  }

  const startEdit = (row: CompanionStandingRow) => {
    if (!row.registrationId) return;
    setEditingId(row.registrationId);
    setDraftUrl(row.moxfieldUrl ?? "");
    setSaveError("");
  };

  const saveEdit = async () => {
    if (editingId == null || !onUpdateMoxfield) return;
    const trimmed = draftUrl.trim();
    if (trimmed && !isValidMoxfieldUrl(trimmed)) {
      setSaveError(t("errors.moxfieldInvalid"));
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await onUpdateMoxfield(editingId, trimmed);
      setEditingId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("companion.results.saveGenericFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveRemap = async () => {
    if (!onRemap) return;
    const links = standings.map((row) => ({
      standingId: row.id,
      registrationId: draftLinks[row.id] === "" || draftLinks[row.id] == null ? null : Number(draftLinks[row.id]),
    }));

    const assigned = links.map((l) => l.registrationId).filter((id): id is number => id != null);
    if (new Set(assigned).size !== assigned.length) {
      setRemapError(t("companion.results.dupLink"));
      return;
    }

    setRemapBusy(true);
    setRemapError("");
    try {
      await onRemap(links);
      setRemapping(false);
    } catch (err) {
      setRemapError(err instanceof Error ? err.message : t("companion.results.saveFailed"));
    } finally {
      setRemapBusy(false);
    }
  };

  const optionsForStanding = (standingId: number) => {
    const current = draftLinks[standingId];
    return registrations.filter((reg) => reg.id === current || !usedRegIds.has(reg.id));
  };

  return (
    <div className="sc-stack" style={{ gap: 16 }}>
      <article className="sc-card cc-companion-report">
        <div className="cc-organizer__section-head">
          <div>
            <h3 className="sc-headline-md">{t("companion.results.final")}</h3>
            <p className="sc-body-sm">
              {t("companion.results.imported")}
              {companionEventCode ? ` (${companionEventCode})` : ""}
              {companionLastPulledAt
                ? ` · ${formatAppDateTime(companionLastPulledAt)}`
                : ""}
              {unmatchedCount > 0 ? ` · ${unmatchedCount}` : ""}
            </p>
          </div>
          <div className="sc-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              className="sc-btn sc-btn--sm sc-btn--secondary"
              type="button"
              onClick={() => downloadStandingsCsv(standings, companionEventCode)}
            >
              <i className="ph ph-download-simple" /> {t("companion.results.export")}
            </button>
            {isOrganizer && onRemap && !remapping && (
              <button
                className="sc-btn sc-btn--sm sc-btn--secondary"
                type="button"
                disabled={busy}
                onClick={() => setRemapping(true)}
              >
                <i className="ph ph-link" /> {t("companion.results.remap")}
              </button>
            )}
          </div>
        </div>

        <div className="cc-table-scroll">
          <div className="cc-standings__table cc-companion-report__table">
            <div className="cc-standings__head cc-companion-report__head">
              <span>#</span>
              <span>{tt("col.player")}</span>
              <span>{tt("col.record")}</span>
              <span>{tt("col.pts")}</span>
              <span>{tt("col.omw")}</span>
              <span>{tt("col.deck")}</span>
            </div>
            {standings.map((row) => (
              <div
                key={row.id}
                className={`cc-standings__row cc-companion-report__row${!row.matched ? " cc-companion-report__row--unmatched" : ""}`}
              >
                <span>{row.rank}</span>
                <span>
                  <strong>{playerName(row)}</strong>
                  {row.registrationName && row.registrationName !== playerName(row) && (
                    <span className="cc-companion-report__email">→ {row.registrationName}</span>
                  )}
                  {!row.matched && (
                    <span className="cc-companion-report__warn">{t("companion.results.unmatched")}</span>
                  )}
                </span>
                <span>
                  {row.wins}-{row.losses}-{row.draws}
                </span>
                <span>{row.matchPoints}</span>
                <span>{formatPct(row.opponentMatchWinPercent)}</span>
                <span className="cc-companion-report__deck">
                  {editingId === row.registrationId ? (
                    <div className="cc-companion-report__edit">
                      <input
                        className="sc-input"
                        value={draftUrl}
                        placeholder={t("reg.moxfieldPlaceholder")}
                        disabled={saving || busy}
                        onChange={(e) => setDraftUrl(e.target.value)}
                      />
                      {saveError && <span className="cc-companion-report__warn">{saveError}</span>}
                      <span className="sc-field__hint">{moxfieldHint()}</span>
                      <div className="sc-row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="sc-btn sc-btn--sm"
                          type="button"
                          disabled={saving || busy}
                          onClick={() => void saveEdit()}
                        >
                          {tc("actions.save")}
                        </button>
                        <button
                          className="sc-btn sc-btn--sm sc-btn--ghost"
                          type="button"
                          disabled={saving}
                          onClick={() => setEditingId(null)}
                        >
                          {tc("actions.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {row.moxfieldUrl ? (
                        <a href={row.moxfieldUrl} target="_blank" rel="noreferrer">
                          {row.deckName || t("companion.results.moxfieldFallback")}
                        </a>
                      ) : (
                        <span className="sc-body-sm">—</span>
                      )}
                      {isOrganizer && row.registrationId && onUpdateMoxfield && !remapping && (
                        <button
                          className="sc-btn sc-btn--sm sc-btn--ghost"
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(row)}
                        >
                          <i className="ph ph-pencil-simple" /> {t("companion.results.edit")}
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </article>

      {remapping && isOrganizer && onRemap && (
        <article className="sc-card">
          <h3 className="sc-headline-md">{t("companion.results.remapTitle")}</h3>
          <p className="sc-body-sm">{t("companion.results.remapBody")}</p>
          <div className="cc-companion-remap">
            {standings.map((row) => (
              <div key={row.id} className="cc-companion-remap__row">
                <div className="cc-companion-remap__standing">
                  <span className="cc-companion-remap__rank">#{row.rank}</span>
                  <strong>{playerName(row)}</strong>
                  {row.companionTeamId && (
                    <span className="cc-companion-report__email">
                      {t("companion.results.team", { id: row.companionTeamId })}
                    </span>
                  )}
                </div>
                <select
                  className="sc-input cc-companion-remap__select"
                  value={draftLinks[row.id] ?? ""}
                  disabled={remapBusy || busy}
                  onChange={(e) =>
                    setDraftLinks((prev) => ({
                      ...prev,
                      [row.id]: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                >
                  <option value="">{t("companion.results.unmatchedOpt")}</option>
                  {optionsForStanding(row.id).map((reg) => (
                    <option key={reg.id} value={reg.id}>
                      {reg.displayName}
                      {reg.email ? ` (${reg.email})` : ""}
                      {reg.isGuest ? ` · ${t("companion.results.guestSuffix")}` : ""}
                      {reg.companionTeamId ? ` · ${t("companion.results.linkedSuffix")}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {remapError && <div className="cc-alert cc-alert--error">{remapError}</div>}
          <div className="sc-row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button
              className="sc-btn sc-btn--sm"
              type="button"
              disabled={remapBusy || busy}
              onClick={() => void saveRemap()}
            >
              {remapBusy ? tc("actions.loading") : t("companion.results.saveLinks")}
            </button>
            <button
              className="sc-btn sc-btn--sm sc-btn--ghost"
              type="button"
              disabled={remapBusy}
              onClick={() => setRemapping(false)}
            >
              {tc("actions.cancel")}
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
