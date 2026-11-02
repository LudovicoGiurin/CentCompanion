export function formatRoundTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseTimerInput(minutes: string, seconds: string): number | null {
  const m = Number(minutes);
  const s = Number(seconds);
  if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0 || s >= 60) return null;
  const total = Math.floor(m) * 60 + Math.floor(s);
  if (total > 86400) return null;
  return total;
}

export function splitTimerSeconds(total: number): { minutes: string; seconds: string } {
  const clamped = Math.max(0, Math.min(86400, Math.floor(total)));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return { minutes: String(m), seconds: s.toString().padStart(2, "0") };
}
