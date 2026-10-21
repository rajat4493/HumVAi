import { LEVELS, solve } from '@hva/game-core';
import type { ChallengeDefinition } from '@hva/game-core';
import { runAttempt, verifyRecord } from '@hva/ai-adapters';
import type { ModelAdapter, PriceTable, RunRecord } from '@hva/ai-adapters';
import { configHash, promptHash } from './config';
import { paths, readJsonl, saveAttempt } from './store';

export interface ExperimentOptions {
  adapters: ModelAdapter[];
  levels: ChallengeDefinition[];
  attemptsPerLevel: number;
  outDir: string;
  prices?: PriceTable | undefined;
  /** Hard stop in dollars (needs prices). New attempts stop at 90%; a running attempt stops at 100%. */
  spendCapUsd?: number | undefined;
  /** Alternative cap when no prices are known. */
  maxTotalTokens?: number | undefined;
  version: string;
  seedPrefix?: string;
  voidRetries?: number;
  log?: (line: string) => void;
}

export interface ExperimentResult {
  completed: RunRecord[];
  skipped: number;
  stoppedBecause: string | null;
  spentUsd: number | null;
  totalTokens: number;
}

const NO_RETRY = new Set(['auth', 'spend-cap', 'token-cap', 'call-cap', 'context_overflow']);

/** Deterministic Fisher-Yates so the interleaving is reproducible for a given seed. */
function shuffle<T>(xs: T[], seed: string): T[] {
  let s = 0;
  for (const c of seed) s = (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export async function runExperiment(o: ExperimentOptions): Promise<ExperimentResult> {
  const log = o.log ?? (() => undefined);
  const p = paths(o.outDir);
  const existing = new Set(readJsonl<RunRecord>(p.records).filter((r) => r.outcome.status !== 'void').map((r) => r.attemptId));
  const prior = readJsonl<RunRecord>(p.records);
  let spent: number | null = o.prices ? prior.reduce((a, r) => a + (r.totals.costUsd ?? 0), 0) : null;
  let tokens = prior.reduce((a, r) => a + r.totals.inputTokens + r.totals.outputTokens, 0);

  const jobs = o.adapters.flatMap((adapter) =>
    o.levels.flatMap((level) =>
      Array.from({ length: o.attemptsPerLevel }, (_, n) => ({ adapter, level, n: n + 1, id: `${level.id}@${level.version}/${adapter.identity.provider}:${adapter.identity.modelId}/${configHash(adapter).slice(7, 15)}/a${String(n + 1).padStart(2, '0')}` })),
    ),
  );
  const ordered = shuffle(jobs, o.seedPrefix ?? 'order');
  const completed: RunRecord[] = [];
  let skipped = 0;
  let stoppedBecause: string | null = null;
  const stopReason = (spentNow: number | null, tokensNow: number): string | null => {
    if (o.spendCapUsd !== undefined && spentNow !== null && spentNow >= o.spendCapUsd) return 'spend-cap';
    if (o.maxTotalTokens !== undefined && tokensNow >= o.maxTotalTokens) return 'token-cap';
    return null;
  };

  outer: for (const job of ordered) {
    if (existing.has(job.id)) {
      skipped += 1;
      continue;
    }
    const soft = (o.spendCapUsd !== undefined ? o.spendCapUsd * 0.9 : undefined) ?? undefined;
    if ((soft !== undefined && spent !== null && spent >= soft) || stopReason(spent, tokens)) {
      stoppedBecause = stopReason(spent, tokens) ?? 'spend-cap (90% reached; no new attempts started)';
      break;
    }
    for (let tryNo = 0; tryNo <= (o.voidRetries ?? 3); tryNo++) {
      const attemptSpentBase = spent;
      const attemptTokensBase = tokens;
      const { record, logs } = await runAttempt({
        attemptId: tryNo === 0 ? job.id : `${job.id}#retry${tryNo}`,
        seed: `${o.seedPrefix ?? 'exp'}-a${String(job.n).padStart(2, '0')}`,
        level: job.level,
        adapter: job.adapter,
        configHash: configHash(job.adapter),
        promptHash: promptHash(),
        runnerVersion: o.version,
        engineVersion: o.version,
        ...(o.prices ? { prices: o.prices } : {}),
        shouldStop: (attemptSpent) => {
          const spentNow = attemptSpentBase !== null && attemptSpent !== null ? attemptSpentBase + attemptSpent : null;
          return stopReason(spentNow, attemptTokensBase);
        },
      });
      const verified = verifyRecord(record, job.level);
      saveAttempt(o.outDir, record, logs, verified);
      spent = spent !== null ? spent + (record.totals.costUsd ?? 0) : null;
      tokens += record.totals.inputTokens + record.totals.outputTokens;
      log(`${record.attemptId}: ${record.outcome.status}${record.outcome.voidReason ? ` (${record.outcome.voidReason})` : ''} run=${record.outcome.runActions} scout=${record.outcome.scoutActions} verified=${String(verified.ok)}`);
      if (record.outcome.status !== 'void') {
        completed.push(record);
        break;
      }
      const reason = record.outcome.voidReason ?? '';
      if (reason === 'auth') {
        stoppedBecause = 'auth failure (check the API key)';
        break outer;
      }
      if (NO_RETRY.has(reason)) {
        if (reason === 'spend-cap' || reason === 'token-cap') {
          stoppedBecause = reason;
          break outer;
        }
        break;
      }
    }
  }
  return { completed, skipped, stoppedBecause, spentUsd: spent, totalTokens: tokens };
}

export const levelsById = (ids: string[] | undefined): ChallengeDefinition[] =>
  ids && ids.length > 0 ? ids.map((id) => LEVELS.find((l) => l.id === id || l.id.startsWith(id)) ?? (() => { throw new Error(`unknown level ${id}`); })()) : [...LEVELS];

export { solve };
