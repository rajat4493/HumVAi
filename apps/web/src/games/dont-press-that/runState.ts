import { PredictionLedger } from './predictions';
import type { AttemptSummary } from './session';

/**
 * What the host remembers about this visit. It lives only in memory: reloading the page starts a fresh run, so nothing about how you
 * played is kept anywhere the next visit could read. (Progress and settings are in storage.ts; this is the host's notebook.)
 */
export const run = {
  ledger: new PredictionLedger(),
  histories: new Map<string, AttemptSummary[]>(),
  /** Ticks spent on winning attempts, per level, for the closing summary. */
  clears: new Map<string, { ticks: number; deaths: number; skipped: boolean }>(),
  reset(): void {
    run.ledger = new PredictionLedger();
    run.histories.clear();
    run.clears.clear();
  },
  totalDeaths(): number {
    let n = 0;
    for (const h of run.histories.values()) n += h.filter((a) => a.outcome === 'death').length;
    return n;
  },
};
