import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "../hooks/useReducedMotion";

export type SignupFightIntent = "login" | "register" | "guest";

const HOLD_MS = 1400;
const VIBRATE_MS = 70;

function HeroFighter() {
  return (
    <svg viewBox="0 0 32 40" width="40" height="50" aria-hidden>
      <rect x="11" y="2" width="10" height="8" fill="#fbf5dd" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="13" y="5" width="2" height="2" fill="#1c1c1c" />
      <rect x="17" y="5" width="2" height="2" fill="#1c1c1c" />
      <rect x="14" y="8" width="4" height="1" fill="#1c1c1c" />
      <rect x="10" y="10" width="12" height="12" fill="#2fa84f" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="8" y="12" width="4" height="8" fill="#156c00" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="20" y="12" width="6" height="3" fill="#f0a232" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="24" y="10" width="4" height="2" fill="#ffd27a" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="12" y="22" width="4" height="10" fill="#6d5526" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="17" y="22" width="4" height="10" fill="#6d5526" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="11" y="32" width="5" height="3" fill="#1c1c1c" />
      <rect x="17" y="32" width="5" height="3" fill="#1c1c1c" />
    </svg>
  );
}

function FoeFighter() {
  return (
    <svg viewBox="0 0 32 40" width="40" height="50" aria-hidden>
      <rect x="10" y="4" width="12" height="10" fill="#d94343" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="12" y="7" width="2" height="2" fill="#ffd27a" />
      <rect x="18" y="7" width="2" height="2" fill="#ffd27a" />
      <rect x="14" y="11" width="4" height="2" fill="#1c1c1c" />
      <rect x="8" y="2" width="3" height="5" fill="#7a1414" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="21" y="2" width="3" height="5" fill="#7a1414" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="9" y="14" width="14" height="12" fill="#8a5510" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="6" y="16" width="5" height="4" fill="#f0a232" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="21" y="16" width="5" height="4" fill="#f0a232" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="11" y="26" width="4" height="8" fill="#6d5526" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="17" y="26" width="4" height="8" fill="#6d5526" stroke="#1c1c1c" strokeWidth="1" />
      <rect x="10" y="34" width="5" height="3" fill="#1c1c1c" />
      <rect x="17" y="34" width="5" height="3" fill="#1c1c1c" />
    </svg>
  );
}

function vibratePulse() {
  try {
    navigator.vibrate?.(28);
  } catch {
    /* ignore */
  }
}

type HoldProps = {
  intent: SignupFightIntent;
  label: string;
  hint?: string;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  activeIntent: SignupFightIntent | null;
  onHoldStart: (intent: SignupFightIntent) => void;
  onHoldCancel: () => void;
  onHoldComplete: (intent: SignupFightIntent) => void;
};

export function HoldFightButton({
  intent,
  label,
  hint,
  variant = "primary",
  disabled = false,
  activeIntent,
  onHoldStart,
  onHoldCancel,
  onHoldComplete,
}: HoldProps) {
  const { t } = useTranslation("events");
  const holdHint = hint ?? t("signup.holdContinue");
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const holding = activeIntent === intent;
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const vibRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (vibRef.current != null) window.clearInterval(vibRef.current);
    vibRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    // Completed hold already started the slash — ignore release cleanup as a cancel.
    if (doneRef.current) {
      setProgress(0);
      return;
    }
    setProgress(0);
    onHoldCancel();
  }, [clearTimers, onHoldCancel]);

  const tick = useCallback(() => {
    const elapsed = performance.now() - startRef.current;
    const next = Math.min(1, elapsed / HOLD_MS);
    setProgress(next);
    if (next >= 1) {
      clearTimers();
      if (!doneRef.current) {
        doneRef.current = true;
        try {
          navigator.vibrate?.([30, 40, 50]);
        } catch {
          /* ignore */
        }
        onHoldComplete(intent);
      }
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [clearTimers, intent, onHoldComplete]);

  const begin = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (disabled) return;
      if (activeIntent && activeIntent !== intent) return;
      if (doneRef.current) return;
      doneRef.current = false;
      onHoldStart(intent);
      if (reduced) {
        doneRef.current = true;
        onHoldComplete(intent);
        return;
      }
      startRef.current = performance.now();
      setProgress(0.02);
      vibratePulse();
      vibRef.current = window.setInterval(vibratePulse, VIBRATE_MS);
      rafRef.current = requestAnimationFrame(tick);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [activeIntent, disabled, intent, onHoldComplete, onHoldStart, reduced, tick],
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  const cls =
    variant === "ghost"
      ? "sc-btn sc-btn--ghost sc-btn--lg cc-hold-fight"
      : "sc-btn sc-btn--lg cc-hold-fight";

  return (
    <div className={`cc-hold-fight-wrap${holding ? " is-holding" : ""}`}>
      <button
        type="button"
        className={`${cls}${holding ? " is-holding" : ""}`}
        aria-label={`${label}. ${holdHint}`}
        disabled={disabled}
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={(e) => {
          if (holding && e.buttons === 0) cancel();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="cc-hold-fight__fill" style={{ transform: `scaleX(${progress})` }} aria-hidden />
        <span className="cc-hold-fight__label">
          <i className={`ph ${intent === "guest" ? "ph-ticket" : intent === "register" ? "ph-user-plus" : "ph-sign-in"}`} aria-hidden />
          {label}
          {holding ? ` · ${Math.round(progress * 100)}%` : ""}
        </span>
        <span className="cc-hold-fight__hint" data-hidden={holding ? "true" : undefined}>
          {holdHint}
        </span>
      </button>

      {holding && !reduced && (
        <div className="cc-hold-fight__brawl" aria-hidden>
          <div className="cc-hold-fight__dude cc-hold-fight__dude--hero">
            <span className="cc-hold-fight__dude-lunge">
              <HeroFighter />
            </span>
          </div>
          <div className="cc-hold-fight__dude cc-hold-fight__dude--foe">
            <span className="cc-hold-fight__dude-lunge">
              <FoeFighter />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** @deprecated — fighters now spawn under HoldFightButton */
export function SignupFightArena(_props: { active: boolean; intent: SignupFightIntent | null }) {
  return null;
}

type SlashProps = {
  open: boolean;
  onDone: () => void;
};

export function SwordSlashOverlay({ open, onDone }: SlashProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const ms = reduced ? 0 : 480;
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [open, onDone, reduced]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="cc-sword-slash" aria-hidden>
      <div className="cc-sword-slash__flash" />
      <div className="cc-sword-slash__blade" />
      <div className="cc-sword-slash__spark cc-sword-slash__spark--1" />
      <div className="cc-sword-slash__spark cc-sword-slash__spark--2" />
      <div className="cc-sword-slash__spark cc-sword-slash__spark--3" />
    </div>,
    document.body,
  );
}

/** @deprecated — hold flow replaced auto overlay */
export function SignupFightOverlay({
  open,
  intent: _intent,
  onDone,
}: {
  open: boolean;
  intent: SignupFightIntent;
  onDone: () => void;
}) {
  useEffect(() => {
    if (open) onDone();
  }, [open, onDone]);
  return null;
}
