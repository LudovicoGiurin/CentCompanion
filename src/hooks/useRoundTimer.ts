import { useEffect, useState } from "react";
import type { RoundTimer } from "../lib/api";
import { formatRoundTimer } from "../lib/roundTimer";

export function useRoundTimer(timer: RoundTimer | null | undefined) {
  const [base, setBase] = useState({ remainingSec: 0, running: false, syncedAt: Date.now() });

  useEffect(() => {
    if (!timer) return;
    setBase({ remainingSec: timer.remainingSec, running: timer.running, syncedAt: Date.now() });
  }, [timer?.remainingSec, timer?.running]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!base.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [base.running]);

  if (!timer) {
    return { displaySec: null as number | null, label: "—", running: false, expired: false };
  }

  const elapsed = base.running ? Math.floor((now - base.syncedAt) / 1000) : 0;
  const displaySec = Math.max(0, base.remainingSec - elapsed);

  return {
    displaySec,
    label: formatRoundTimer(displaySec),
    running: base.running && displaySec > 0,
    expired: displaySec <= 0 && base.remainingSec > 0,
  };
}
