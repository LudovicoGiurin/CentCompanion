import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RoundTimer } from "../lib/api";
import { useRoundTimer } from "../hooks/useRoundTimer";
import { parseTimerInput, splitTimerSeconds } from "../lib/roundTimer";

type Props = {
  timer: RoundTimer | null;
  disabled?: boolean;
  busy?: boolean;
  onUpdate: (remainingSec: number, running: boolean) => Promise<void>;
  variant?: "organizer" | "compact";
};

export function RoundTimerControl({
  timer,
  disabled,
  busy,
  onUpdate,
  variant = "organizer",
}: Props) {
  const { t } = useTranslation("tournament");
  const { displaySec, label, running, expired } = useRoundTimer(timer);
  const [minutes, setMinutes] = useState("50");
  const [seconds, setSeconds] = useState("00");

  useEffect(() => {
    if (running) return;
    if (displaySec == null) return;
    const parts = splitTimerSeconds(displaySec);
    setMinutes(parts.minutes);
    setSeconds(parts.seconds);
  }, [displaySec, running, timer?.remainingSec, timer?.running]);

  const apply = async (remainingSec: number, nextRunning: boolean) => {
    await onUpdate(remainingSec, nextRunning);
  };

  const applyFromInputs = async (nextRunning: boolean) => {
    const total = parseTimerInput(minutes, seconds);
    if (total == null) return;
    await apply(total, nextRunning);
  };

  const adjust = async (deltaSec: number) => {
    const base = displaySec ?? parseTimerInput(minutes, seconds) ?? 0;
    await apply(Math.max(0, Math.min(86400, base + deltaSec)), running);
  };

  const isCompact = variant === "compact";

  return (
    <div className={`cc-round-timer${isCompact ? " cc-round-timer--compact" : ""}`}>
      <div className="cc-round-timer__display-wrap">
        <span className="cc-round-timer__label">{t("timer.label")}</span>
        <div
          className={`cc-round-timer__display${running ? " cc-round-timer__display--running" : ""}${expired ? " cc-round-timer__display--expired" : ""}`}
          aria-live="polite"
        >
          {label}
        </div>
        {running && <span className="cc-round-timer__status">{t("timer.running")}</span>}
        {!running && displaySec != null && displaySec > 0 && (
          <span className="cc-round-timer__status cc-round-timer__status--paused">{t("timer.paused")}</span>
        )}
        {expired && <span className="cc-round-timer__status cc-round-timer__status--expired">{t("timer.expired")}</span>}
      </div>

      {!isCompact && (
        <div className="cc-round-timer__set">
          <label className="sc-field cc-round-timer__field">
            <span className="sc-field__label">{t("timer.setRemaining")}</span>
            <div className="cc-round-timer__inputs">
              <input
                className="sc-input cc-round-timer__input"
                type="number"
                min={0}
                max={1440}
                value={minutes}
                disabled={disabled || busy}
                onChange={(e) => setMinutes(e.target.value)}
                aria-label={t("timer.minutes")}
              />
              <span className="cc-round-timer__colon">:</span>
              <input
                className="sc-input cc-round-timer__input"
                type="number"
                min={0}
                max={59}
                value={seconds}
                disabled={disabled || busy}
                onChange={(e) => setSeconds(e.target.value)}
                aria-label={t("timer.seconds")}
              />
            </div>
          </label>
          <div className="cc-round-timer__presets">
            <button type="button" className="sc-btn sc-btn--sm sc-btn--ghost" disabled={disabled || busy} onClick={() => void apply(50 * 60, false)}>
              50:00
            </button>
            <button type="button" className="sc-btn sc-btn--sm sc-btn--ghost" disabled={disabled || busy} onClick={() => void adjust(300)}>
              +5:00
            </button>
            <button type="button" className="sc-btn sc-btn--sm sc-btn--ghost" disabled={disabled || busy} onClick={() => void adjust(-300)}>
              −5:00
            </button>
          </div>
        </div>
      )}

      <div className="cc-round-timer__actions">
        {running ? (
          <button
            type="button"
            className="sc-btn sc-btn--secondary sc-btn--sm"
            disabled={disabled || busy}
            onClick={() => void apply(displaySec ?? 0, false)}
          >
            <i className="ph ph-pause" /> {t("timer.pause")}
          </button>
        ) : (
          <button
            type="button"
            className="sc-btn sc-btn--sm"
            disabled={disabled || busy}
            onClick={() => void applyFromInputs(true)}
          >
            <i className="ph ph-play" /> {displaySec != null && displaySec > 0 ? t("timer.resume") : t("timer.start")}
          </button>
        )}
        {!isCompact && (
          <button
            type="button"
            className="sc-btn sc-btn--sm sc-btn--secondary"
            disabled={disabled || busy}
            onClick={() => void applyFromInputs(running)}
          >
            <i className="ph ph-clock" /> {t("timer.apply")}
          </button>
        )}
      </div>
    </div>
  );
}

export function RoundTimerBanner({ timer }: { timer: RoundTimer | null }) {
  const { t } = useTranslation("tournament");
  const { label, running, expired } = useRoundTimer(timer);
  if (!timer) return null;

  return (
    <div
      className={`cc-round-timer-banner${running ? " cc-round-timer-banner--running" : ""}${expired ? " cc-round-timer-banner--expired" : ""}`}
      aria-live="polite"
    >
      <span className="cc-round-timer-banner__label">{t("timer.label")}</span>
      <strong className="cc-round-timer-banner__time">{label}</strong>
    </div>
  );
}
