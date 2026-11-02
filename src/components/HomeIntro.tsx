import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "../hooks/useReducedMotion";

const SEEN_KEY = "cc_home_intro_seen";
const LOAD_MS = 1800;
const DOCK_MS = 1100;

type Phase = "load" | "dock" | "done";

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // ignore storage access errors
  }
}

export function HomeIntro() {
  const { t } = useTranslation("common");
  const reduced = useReducedMotion();
  const [params] = useSearchParams();
  const force = params.get("intro") === "1";
  const shouldPlay = force || (!reduced && !alreadySeen());
  const [phase, setPhase] = useState<Phase>(() => (shouldPlay ? "load" : "done"));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (phase === "done") {
      document.documentElement.classList.remove("cc-intro-playing");
      return;
    }
    document.documentElement.classList.add("cc-intro-playing");
    return () => document.documentElement.classList.remove("cc-intro-playing");
  }, [phase]);

  useEffect(() => {
    if (phase !== "load") return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const ratio = Math.min(1, (now - started) / LOAD_MS);
      setProgress(ratio);
      if (ratio < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setPhase("dock");
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      document.body.style.overflow = previous;
      cancelAnimationFrame(frame);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "dock") return;
    const timer = window.setTimeout(() => {
      if (!force) markSeen();
      setPhase("done");
    }, DOCK_MS);
    return () => window.clearTimeout(timer);
  }, [phase, force]);

  if (phase === "done" || reduced) return null;

  const pct = Math.round(progress * 100);

  return createPortal(
    <div
      className={`cc-intro${phase === "dock" ? " is-docking" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-busy={phase === "load"}
      aria-label={t("home.intro.label")}
    >
      <div className="cc-intro__stage" aria-hidden={phase === "dock"}>
        <p className="cc-intro__boot">{t("home.intro.boot")}</p>
        <div
          className="cc-intro__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t("home.intro.boot")}
        >
          <div className="cc-intro__bar-track">
            <div
              className="cc-intro__bar-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="cc-intro__pct">{pct}%</span>
        </div>
      </div>

      <div className="cc-intro__scan" aria-hidden="true" />
    </div>,
    document.body,
  );
}
