import type { ChallengeDefinition, GameAction, GameEvent } from '@hva/game-core';
import { create, evaluate, hashString, legalActions, observe, step } from '@hva/game-core';
import { buildMessages, buildTurnMessage, SYSTEM_PROMPT } from './prompt';
import type { Turn } from './prompt';
import { parseReply } from './parse';
import { costOf, priceKey } from './stats';
import type { CallLog, ModelAdapter, PriceTable, RunRecord, StepRecord } from './types';
import { AdapterError, SCHEMA_RUN } from './types';

export interface RunLimits {
  maxRejected: number;
  /** Extra calls beyond E + X + maxRejected before the attempt is voided (retries inside the adapter are not counted). */
  extraCalls: number;
  timeoutMs: number;
  maxOutputTokens: number | null;
}

/** Operational limits only: chosen so normal play never meets them (docs/ai/experiment-spec.md section 6). */
export const DEFAULT_LIMITS: RunLimits = { maxRejected: 20, extraCalls: 10, timeoutMs: 300_000, maxOutputTokens: null };

export interface RunOptions {
  attemptId: string;
  seed: string;
  level: ChallengeDefinition;
  adapter: ModelAdapter;
  configHash: string;
  promptHash: string;
  runnerVersion: string;
  engineVersion: string;
  prices?: PriceTable;
  limits?: Partial<RunLimits>;
  /** Checked before every call; a string stops the attempt as void with that reason (e.g. spend cap reached). */
  shouldStop?: (spentSoFarUsd: number | null) => string | null;
  now?: () => Date;
}

export interface RunResult {
  record: RunRecord;
  logs: CallLog[];
}

/**
 * Plays one attempt. The model only ever proposes an action; the engine validates and executes it.
 * Nothing but observe() + events + legalActions() + the briefing reaches the model.
 */
export async function runAttempt(opts: RunOptions): Promise<RunResult> {
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const { level, adapter } = opts;
  const now = opts.now ?? (() => new Date());
  const startedAt = now();
  const t0 = performance.now();

  const state = create(level, opts.seed);
  const history: Turn[] = [];
  const steps: StepRecord[] = [];
  const logs: CallLog[] = [];
  const flags: string[] = [];
  let parseFailures = 0;
  let lastEvents: GameEvent[] | null = null;
  let rejection: string | null = null;
  let terminal: 'won' | 'lost' | 'forfeit' | 'void' | null = null;
  let voidReason: string | null = null;
  const callCap = level.budget.explore + level.budget.execute + limits.maxRejected + limits.extraCalls;
  const price = opts.prices?.[priceKey(adapter.identity)];
  let spent: number | null = price ? 0 : null;

  while (state.status === 'playing' && terminal === null) {
    const stop = opts.shouldStop?.(spent) ?? null;
    if (stop) {
      terminal = 'void';
      voidReason = stop;
      break;
    }
    if (steps.length >= callCap) {
      terminal = 'void';
      voidReason = 'call-cap';
      break;
    }

    const obs = observe(state);
    const user = buildTurnMessage({ briefing: level.briefing, observation: obs, lastEvents, legalActions: legalActions(state), rejection });
    history.push({ user });
    let resp;
    try {
      resp = await adapter.decide(
        { schemaVersion: 'hva.turn.1', system: SYSTEM_PROMPT, messages: buildMessages(history), limits: { maxOutputTokens: limits.maxOutputTokens, timeoutMs: limits.timeoutMs } },
        AbortSignal.timeout(limits.timeoutMs + 5_000),
      );
    } catch (e) {
      terminal = 'void';
      voidReason = e instanceof AdapterError ? e.kind : 'unexpected-error';
      flags.push(`call-failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
      history.pop();
      break;
    }
    const last = history[history.length - 1] as Turn;
    last.assistant = resp.raw;

    const callMetrics = {
      inputTokens: resp.usage.inputTokens,
      outputTokens: resp.usage.outputTokens,
      cachedInputTokens: resp.usage.cachedInputTokens,
      reasoningTokens: resp.usage.reasoningTokens,
      latencyMs: resp.latencyMs,
      finishReason: resp.finishReason,
      providerRequestId: resp.providerRequestId,
      respondedModel: resp.respondedModel,
      retries: resp.retries,
    };
    if (resp.respondedModel && !resp.respondedModel.startsWith(adapter.identity.modelId) && !flags.includes('model-mismatch')) flags.push('model-mismatch');
    if (price && spent !== null) {
      spent += costOf(price, { inputTokens: resp.usage.inputTokens, outputTokens: resp.usage.outputTokens, cachedInputTokens: resp.usage.cachedInputTokens ?? 0 }) ?? 0;
    }
    logs.push({ attemptId: opts.attemptId, i: steps.length, userMessage: user, rawResponse: resp.raw });

    const parsed = parseReply(resp.raw);
    const phase = state.phase;
    const obsHash = hashString(JSON.stringify(obs));
    if (!parsed.ok) {
      parseFailures += 1;
      rejection = parsed.reason;
      lastEvents = null;
      steps.push({ i: steps.length, phase, obsHash, action: null, valid: false, rejection: parsed.reason, events: [], note: null, call: callMetrics });
    } else {
      const result = step(state, parsed.action);
      const reason = result.valid ? null : (result.events.find((e) => e.type === 'REJECTED') as { reason: string } | undefined)?.reason ?? 'rejected';
      rejection = reason;
      lastEvents = result.valid ? result.events : null;
      steps.push({ i: steps.length, phase, obsHash, action: parsed.action, valid: result.valid, rejection: reason, events: result.events, note: parsed.note, call: callMetrics });
    }
    if (parseFailures + state.rejectedActions >= limits.maxRejected && state.status === 'playing') terminal = 'forfeit';
    if (resp.finishReason === 'length' && !flags.includes('truncated-reply')) flags.push('truncated-reply');
  }

  const ev = evaluate(state);
  const status = state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : (terminal ?? 'void');
  const totals = steps.reduce(
    (a, s) => ({
      inputTokens: a.inputTokens + s.call.inputTokens,
      outputTokens: a.outputTokens + s.call.outputTokens,
      cachedInputTokens: a.cachedInputTokens + (s.call.cachedInputTokens ?? 0),
      reasoningTokens: a.reasoningTokens + (s.call.reasoningTokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningTokens: 0 },
  );
  const record: RunRecord = {
    schema: SCHEMA_RUN,
    attemptId: opts.attemptId,
    challengeId: level.id,
    challengeVersion: level.version,
    seed: opts.seed,
    condition: 'A',
    model: adapter.identity,
    sampling: adapter.sampling,
    configHash: opts.configHash,
    promptHash: opts.promptHash,
    runnerVersion: opts.runnerVersion,
    engineVersion: opts.engineVersion,
    startedAt: startedAt.toISOString(),
    finishedAt: now().toISOString(),
    steps,
    outcome: {
      status,
      voidReason: status === 'void' ? voidReason : null,
      scoutActions: ev.scoutActions,
      runActions: ev.runActions,
      rejectedActions: parseFailures + ev.rejectedActions,
      finalStateHash: ev.finalStateHash,
    },
    totals: { calls: steps.length, ...totals, costUsd: price ? costOf(price, totals) : null, wallMs: Math.round(performance.now() - t0) },
    flags,
  };
  return { record, logs };
}

export type { GameAction };
