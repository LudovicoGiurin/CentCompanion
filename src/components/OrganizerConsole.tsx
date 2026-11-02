import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { EventItem, MatchItem, Registration, RoundTimer } from "../lib/api";
import { useIsPhone } from "../hooks/useIsPhone";
import { Modal } from "./Modal";
import { RoundTimerControl } from "./RoundTimerControl";

type EditablePairing = {
  tableNumber: number;
  player1Id: number;
  player2Id: number | null;
};

type Props = {
  event: EventItem;
  eventId: number;
  registrations: Registration[];
  matches: MatchItem[];
  round: number;
  currentRound: number;
  isLiveRound: boolean;
  pairingBusy: boolean;
  pendingCount: number;
  rerollCount: number;
  roundTimer: RoundTimer | null;
  onRegenerate: () => Promise<void>;
  onEndRound: () => void;
  onResumeSwiss?: () => void;
  onComplete: () => void;
  phaseKind?: "swiss" | "top_cut";
  onDropPlayer: (registrationId: number) => Promise<void>;
  onSavePairings: (pairings: EditablePairing[]) => Promise<void>;
  onSetRoundTimer: (remainingSec: number, running: boolean) => Promise<void>;
};

function activePlayers(regs: Registration[]) {
  return regs.filter((r) => r.registrationStatus === "confirmed");
}

function pairablePlayers(regs: Registration[]) {
  return activePlayers(regs).filter((r): r is Registration & { userId: number } => r.userId != null);
}

function matchesToEditable(matches: MatchItem[]): EditablePairing[] {
  return matches.map((m) => ({
    tableNumber: m.tableNumber ?? 0,
    player1Id: m.player1Id,
    player2Id: m.player2Id,
  }));
}

function PhoneDetails({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="cc-organizer-phone-details">
      <summary className="cc-organizer-phone-details__summary">
        <span>{title}</span>
        <i className="ph ph-caret-down" aria-hidden />
      </summary>
      <div className="cc-organizer-phone-details__body">{children}</div>
    </details>
  );
}

export function OrganizerConsole({
  event,
  eventId,
  registrations,
  matches,
  round,
  currentRound,
  isLiveRound,
  pairingBusy,
  pendingCount,
  rerollCount,
  roundTimer,
  onRegenerate,
  onEndRound,
  onResumeSwiss,
  onComplete,
  phaseKind = "swiss",
  onDropPlayer,
  onSavePairings,
  onSetRoundTimer,
}: Props) {
  const { t } = useTranslation("tournament");
  const { t: tc } = useTranslation("common");
  const isPhone = useIsPhone();
  const players = useMemo(() => activePlayers(registrations), [registrations]);
  const editablePlayers = useMemo(() => pairablePlayers(registrations), [registrations]);
  const [editingPairings, setEditingPairings] = useState(false);
  const [draftPairings, setDraftPairings] = useState<EditablePairing[]>([]);
  const [dropTarget, setDropTarget] = useState<Registration | null>(null);
  const [dropBusy, setDropBusy] = useState(false);

  useEffect(() => {
    if (!editingPairings) setDraftPairings(matchesToEditable(matches));
  }, [matches, editingPairings]);

  const assignedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const p of draftPairings) {
      ids.add(p.player1Id);
      if (p.player2Id) ids.add(p.player2Id);
    }
    return ids;
  }, [draftPairings]);

  const unassigned = editablePlayers.filter((p) => !assignedIds.has(p.userId));

  const startEditing = () => {
    setDraftPairings(matchesToEditable(matches));
    setEditingPairings(true);
  };

  const updatePairing = (index: number, patch: Partial<EditablePairing>) => {
    setDraftPairings((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSavePairings = async () => {
    try {
      await onSavePairings(
        draftPairings.map((p, index) => ({
          ...p,
          tableNumber: index + 1,
        })),
      );
      setEditingPairings(false);
    } catch {
      /* parent shows error toast */
    }
  };

  const confirmDrop = async () => {
    if (!dropTarget) return;
    setDropBusy(true);
    try {
      await onDropPlayer(dropTarget.id);
      setDropTarget(null);
    } finally {
      setDropBusy(false);
    }
  };

  const showLiveControls = event.status === "ongoing" && isLiveRound && round === currentRound;
  const canResumeSwiss =
    event.status === "ongoing" &&
    phaseKind === "top_cut" &&
    (event.tournamentStructure === "swiss_top_cut" || event.tournamentStructure === "swiss") &&
    !!onResumeSwiss;
  const btnSize = isPhone ? "sc-btn--lg" : "sc-btn--sm";

  const actions = (
    <div className={`cc-organizer__actions${isPhone ? " cc-organizer__actions--phone" : ""}`}>
      {canResumeSwiss && (
        <button
          className={`sc-btn ${btnSize} cc-organizer__action-primary`}
          type="button"
          disabled={pairingBusy}
          onClick={onResumeSwiss}
          title={t("console.resumeSwissHint")}
        >
          <i className="ph ph-arrow-u-up-left" /> {t("console.resumeSwiss")}
        </button>
      )}
      {showLiveControls && (
        <button
          className={`sc-btn ${btnSize} cc-organizer__action-primary`}
          type="button"
          disabled={pairingBusy || pendingCount > 0}
          onClick={onEndRound}
        >
          <i className="ph ph-arrow-right" /> {t("console.endRound")}
        </button>
      )}
      <Link
        className={`sc-btn sc-btn--secondary ${btnSize}`}
        to={`/events/${eventId}/display`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <i className="ph ph-monitor" /> {t("console.display")}
      </Link>
      {showLiveControls && (
        <>
          {phaseKind !== "top_cut" && (
            <button
              className={`sc-btn ${btnSize} sc-btn--secondary`}
              type="button"
              disabled={pairingBusy}
              onClick={() => void onRegenerate()}
            >
              <i className="ph ph-shuffle" />
              {rerollCount > 0 ? t("console.reroll", { n: rerollCount }) : t("console.regenerate")}
            </button>
          )}
          <button
            className={`sc-btn ${btnSize} sc-btn--secondary`}
            type="button"
            disabled={pairingBusy}
            onClick={onComplete}
          >
            <i className="ph ph-flag" /> {t("console.complete")}
          </button>
        </>
      )}
    </div>
  );

  const manualBody = (
    <>
      <div className="cc-organizer__section-head">
        {!isPhone && <h3 className="sc-headline-md">{t("console.manual")}</h3>}
        {!editingPairings ? (
          <button
            className={`sc-btn sc-btn--secondary ${btnSize}`}
            type="button"
            disabled={pairingBusy || !matches.length}
            onClick={startEditing}
          >
            <i className="ph ph-pencil-simple" /> {t("console.editRound", { n: round })}
          </button>
        ) : (
          <div className={`sc-row cc-organizer__edit-actions${isPhone ? " cc-organizer__edit-actions--phone" : ""}`}>
            <button
              className={`sc-btn sc-btn--ghost ${btnSize}`}
              type="button"
              disabled={pairingBusy}
              onClick={() => setEditingPairings(false)}
            >
              {tc("actions.cancel")}
            </button>
            <button
              className={`sc-btn ${btnSize}`}
              type="button"
              disabled={pairingBusy || !!unassigned.length}
              onClick={() => void handleSavePairings()}
            >
              {t("console.savePairings")}
            </button>
          </div>
        )}
      </div>

      {!editingPairings ? (
        <p className="sc-body-sm">{t("console.manualHint")}</p>
      ) : (
        <>
          {unassigned.length > 0 && (
            <p className="sc-body-sm cc-organizer__warn">
              {t("console.unassigned", { names: unassigned.map((p) => p.displayName).join(", ") })}
            </p>
          )}
          <div className="cc-manual-pairings">
            {draftPairings.map((row, index) => (
              <div key={`${row.tableNumber}-${index}`} className="cc-manual-pairings__row">
                <span className="cc-manual-pairings__table">T{index + 1}</span>
                <select
                  className="sc-input cc-manual-pairings__select"
                  value={row.player1Id}
                  disabled={pairingBusy}
                  onChange={(e) => updatePairing(index, { player1Id: Number(e.target.value) })}
                >
                  {editablePlayers.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
                <span className="cc-manual-pairings__vs">{t("vsLower")}</span>
                <select
                  className="sc-input cc-manual-pairings__select"
                  value={row.player2Id ?? ""}
                  disabled={pairingBusy}
                  onChange={(e) =>
                    updatePairing(index, {
                      player2Id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">{t("result.bye")}</option>
                  {editablePlayers
                    .filter((p) => p.userId !== row.player1Id)
                    .map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.displayName}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );

  const dropBody = (
    <>
      {!isPhone && <h3 className="sc-headline-md">{t("console.drop.title")}</h3>}
      <p className="sc-body-sm">{t("console.drop.lede")}</p>
      <ul className="cc-organizer__roster">
        {players.map((p) => (
          <li key={p.id} className="cc-organizer__roster-item">
            <span>{p.displayName}</span>
            <button
              className={`sc-btn sc-btn--ghost ${isPhone ? "sc-btn--sm" : "sc-btn--sm"}`}
              type="button"
              disabled={pairingBusy || dropBusy}
              onClick={() => setDropTarget(p)}
            >
              {t("console.drop.btn")}
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div className={`cc-organizer sc-stack${isPhone ? " cc-organizer--phone" : ""}`} style={{ gap: 16 }}>
      <article className="sc-card">
        <h3 className="sc-headline-md">{t("console.title")}</h3>
        {actions}
        {showLiveControls && pendingCount > 0 && (
          <p className="sc-body-sm" style={{ marginTop: 10 }}>
            {t("console.pending", { count: pendingCount, n: pendingCount })}
          </p>
        )}
      </article>

      {showLiveControls && (
        <article className="sc-card">
          <RoundTimerControl
            timer={roundTimer}
            disabled={pairingBusy}
            busy={pairingBusy}
            onUpdate={onSetRoundTimer}
          />
        </article>
      )}

      {showLiveControls &&
        (isPhone ? (
          <article className="sc-card">
            <PhoneDetails title={t("console.manual")}>{manualBody}</PhoneDetails>
          </article>
        ) : (
          <article className="sc-card">{manualBody}</article>
        ))}

      {(event.status === "ongoing" || event.status === "upcoming") &&
        players.length > 0 &&
        (isPhone ? (
          <article className="sc-card">
            <PhoneDetails title={t("console.drop.title")}>{dropBody}</PhoneDetails>
          </article>
        ) : (
          <article className="sc-card">{dropBody}</article>
        ))}

      {dropTarget && (
        <Modal
          open
          title={t("console.drop.confirmTitle")}
          confirmLabel={t("console.drop.confirmLabel")}
          confirmVariant="danger"
          busy={dropBusy}
          onConfirm={() => void confirmDrop()}
          onCancel={() => setDropTarget(null)}
        >
          <p>
            {t("console.drop.confirmBody", { name: dropTarget.displayName })}
            {event.status === "ongoing" && ` ${t("console.drop.forfeit")}`}
          </p>
        </Modal>
      )}
    </div>
  );
}
