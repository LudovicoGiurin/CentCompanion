import { motion } from "framer-motion";
import { useReducedMotion, motionDuration } from "../hooks/useReducedMotion";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageVariantsReduced = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 1, y: 0 },
};

export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const variants = reduced ? pageVariantsReduced : pageVariants;
  const dur = motionDuration(reduced, 0.32);

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: dur, ease: [0, 0.8, 0.26, 0.99] }}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const dur = motionDuration(reduced, 0.5);

  return (
    <motion.div
      className={className}
      initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: dur, delay: reduced ? 0 : delay, ease: [0, 0.8, 0.26, 0.99] }}
    >
      {children}
    </motion.div>
  );
}

export function QuestBar({
  label,
  value,
  max,
  variant = "primary",
}: {
  label: string;
  value: number;
  max: number;
  variant?: "primary" | "gold" | "danger";
}) {
  const cells = Math.min(max, 14);
  const filled = Math.round((value / max) * cells);
  const filledClass =
    variant === "gold" ? "is-filled is-filled--gold" : variant === "danger" ? "is-filled is-filled--danger" : "is-filled";

  return (
    <div className="sc-questbar" style={{ "--cells": cells } as React.CSSProperties}>
      <div className="sc-questbar__head">
        <span>{label}</span>
        <span style={{ color: "var(--sc-primary)", fontFamily: "var(--sc-font-display)", fontSize: 11 }}>
          {value} / {max}
        </span>
      </div>
      <div className="sc-questbar__track">
        <div className="sc-questbar__cells" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
          {Array.from({ length: cells }, (_, i) => (
            <span key={i} className={`sc-questbar__cell ${i < filled ? filledClass : ""}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: string;
};

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  className = "",
  layout = "bar",
  variant = "motion",
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
  layout?: "bar" | "sidebar";
  variant?: "motion" | "spritecraft";
}) {
  const reduced = useReducedMotion();
  const indicatorId = layout === "sidebar" ? "cc-tab-indicator-sidebar" : "cc-tab-indicator-bar";
  const useSpritecraft = variant === "spritecraft";
  const rootClass = useSpritecraft
    ? `sc-tabs cc-hub-tabs${layout === "sidebar" ? " cc-hub-tabs--sidebar" : ""} ${className}`.trim()
    : `sc-tabs cc-tabs cc-tabs--${layout} ${className}`.trim();

  return (
    <div
      className={rootClass}
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={layout === "sidebar" ? "vertical" : "horizontal"}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            className={`sc-tabs__btn${isActive ? " is-active" : ""}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            type="button"
            onClick={() => onChange(tab.id)}
          >
            {isActive && !reduced && !useSpritecraft && (
              <motion.span
                layoutId={indicatorId}
                className="cc-tabs__indicator"
                transition={{ duration: 0.22, ease: [0, 0.8, 0.26, 0.99] }}
              />
            )}
            <span className={useSpritecraft ? "cc-hub-tabs__label" : "cc-tabs__content"}>
              {tab.icon && <i className={`ph ${tab.icon}`} aria-hidden="true" />}
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
  className = "",
}: {
  id: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const dur = motionDuration(reduced, 0.22);

  if (!active) return null;

  if (reduced) {
    return (
      <div id={`tabpanel-${id}`} role="tabpanel" aria-labelledby={id} className={className}>
        {children}
      </div>
    );
  }

  // No exit animation on purpose: each TabPanel is its own AnimatePresence
  // boundary, so an exiting panel would stay in the DOM alongside the newly
  // mounted one, stretching the page until the exit finishes. Unmount the old
  // panel immediately and only animate the incoming one.
  return (
    <motion.div
      key={id}
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={id}
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur, ease: [0, 0.8, 0.26, 0.99] }}
    >
      {children}
    </motion.div>
  );
}

export function SlidePanel({
  direction,
  children,
  className = "",
}: {
  direction: 1 | -1;
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const dur = motionDuration(reduced, 0.28);

  return (
    <motion.div
      className={className}
      initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : direction * 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : direction * -16 }}
      transition={{ duration: dur, ease: [0, 0.8, 0.26, 0.99] }}
    >
      {children}
    </motion.div>
  );
}
