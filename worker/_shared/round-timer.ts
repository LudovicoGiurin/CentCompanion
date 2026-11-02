export type RoundTimerRow = {
  roundTimerSec: number | null;
  roundTimerRunning: boolean;
  roundTimerAt: Date | null;
};

export type RoundTimerState = {
  remainingSec: number;
  running: boolean;
};

export function computeRoundTimerRemaining(row: RoundTimerRow, now = new Date()): number | null {
  if (row.roundTimerSec == null) return null;
  if (!row.roundTimerRunning || !row.roundTimerAt) return row.roundTimerSec;
  const elapsed = Math.floor((now.getTime() - row.roundTimerAt.getTime()) / 1000);
  return Math.max(0, row.roundTimerSec - elapsed);
}

export function serializeRoundTimer(row: RoundTimerRow | null | undefined): RoundTimerState | null {
  if (!row || row.roundTimerSec == null) return null;
  const remainingSec = computeRoundTimerRemaining(row) ?? 0;
  return {
    remainingSec,
    running: row.roundTimerRunning && remainingSec > 0,
  };
}

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
