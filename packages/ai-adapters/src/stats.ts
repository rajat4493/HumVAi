import type { ModelIdentity, PriceEntry, RunRecord, RunTotals } from './types';

export const priceKey = (m: Pick<ModelIdentity, 'provider' | 'modelId'>): string => `${m.provider}:${m.modelId}`;

/** Cost of one set of token counts under an operator-supplied price; null when no price is known. */
export function costOf(price: PriceEntry | undefined, t: Pick<RunTotals, 'inputTokens' | 'outputTokens' | 'cachedInputTokens'>): number | null {
  if (!price) return null;
  const uncached = t.inputTokens - t.cachedInputTokens;
  const cachedRate = price.cachedInputPerMTok ?? price.inputPerMTok;
  return (uncached * price.inputPerMTok + t.cachedInputTokens * cachedRate + t.outputTokens * price.outputPerMTok) / 1_000_000;
}

export function wilson(k: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 1 };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, (c - m) / d), hi: Math.min(1, (c + m) / d) };
}

export const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor((s.length - 1) / 2);
  return s[mid] ?? null; // lower median, as in the published selection rule
};

export const percentile = (xs: number[], p: number): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] ?? null;
};

export interface Summary {
  model: string;
  challengeId: string;
  attempts: number;
  won: number;
  lost: number;
  forfeit: number;
  voided: number;
  winRate: { lo: number; hi: number };
  medianRunActions: number | null;
  medianScoutActions: number | null;
  calls: number;
  /** Replies that were parseable and accepted by the engine, over all replies. */
  legalActionRate: number | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  latencyMsP50: number | null;
  latencyMsP90: number | null;
  wallMsMedian: number | null;
}

/** Aggregates records of one (model, level). Voids are counted but excluded from win/loss rates. */
export function summarize(records: RunRecord[]): Summary {
  const first = records[0];
  if (!first) throw new Error('summarize needs at least one record');
  const counted = records.filter((r) => r.outcome.status !== 'void');
  const won = counted.filter((r) => r.outcome.status === 'won');
  const steps = records.flatMap((r) => r.steps);
  const latencies = steps.map((s) => s.call.latencyMs);
  const costs = records.map((r) => r.totals.costUsd);
  return {
    model: `${first.model.provider}:${first.model.modelId}`,
    challengeId: first.challengeId,
    attempts: records.length,
    won: won.length,
    lost: counted.filter((r) => r.outcome.status === 'lost').length,
    forfeit: counted.filter((r) => r.outcome.status === 'forfeit').length,
    voided: records.length - counted.length,
    winRate: wilson(won.length, counted.length),
    medianRunActions: median(won.map((r) => r.outcome.runActions)),
    medianScoutActions: median(counted.map((r) => r.outcome.scoutActions)),
    calls: steps.length,
    legalActionRate: steps.length === 0 ? null : steps.filter((s) => s.valid).length / steps.length,
    inputTokens: records.reduce((a, r) => a + r.totals.inputTokens, 0),
    outputTokens: records.reduce((a, r) => a + r.totals.outputTokens, 0),
    costUsd: costs.every((c) => c !== null) ? costs.reduce((a, c) => a + (c as number), 0) : null,
    latencyMsP50: percentile(latencies, 0.5),
    latencyMsP90: percentile(latencies, 0.9),
    wallMsMedian: median(records.map((r) => r.totals.wallMs)),
  };
}
