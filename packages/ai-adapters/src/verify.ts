import type { ChallengeDefinition } from '@hva/game-core';
import { create, evaluate, hashString, observe, step } from '@hva/game-core';
import type { RunRecord } from './types';
import { SCHEMA_RUN } from './types';

export interface Verification {
  ok: boolean;
  errors: string[];
}

/**
 * Independent replay of a record against the engine (docs/ai/experiment-spec.md section 10).
 * It trusts nothing the runner computed: observations, validity, events, counters and the final hash
 * are all recomputed from the action list.
 */
export function verifyRecord(record: RunRecord, level: ChallengeDefinition, opts: { maxRejected?: number } = {}): Verification {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  if (record.schema !== SCHEMA_RUN) err(`unknown schema ${String(record.schema)}`);
  if (record.challengeId !== level.id || record.challengeVersion !== level.version) {
    err(`record is for ${record.challengeId}@${record.challengeVersion}, verifying against ${level.id}@${level.version}`);
    return { ok: false, errors };
  }

  const state = create(level, record.seed);
  let parseFailures = 0;
  let ended = false;
  record.steps.forEach((s, idx) => {
    if (s.i !== idx) err(`step ${idx}: index field says ${s.i}`);
    if (ended) {
      err(`step ${idx}: action after the game ended`);
      return;
    }
    const obs = observe(state);
    if (s.phase !== state.phase) err(`step ${idx}: phase ${s.phase} but the engine is in ${state.phase}`);
    if (s.obsHash !== hashString(JSON.stringify(obs))) err(`step ${idx}: observation hash differs from what the engine would have shown`);
    if (s.action === null) {
      parseFailures += 1;
      if (s.valid || s.events.length > 0) err(`step ${idx}: unparsed reply recorded as valid or with events`);
      return;
    }
    const r = step(state, s.action);
    if (r.valid !== s.valid) err(`step ${idx}: valid=${String(s.valid)} but the engine says ${String(r.valid)}`);
    if (JSON.stringify(r.events) !== JSON.stringify(s.events)) err(`step ${idx}: events differ from the engine's`);
    if (state.status !== 'playing') ended = true;
  });

  const ev = evaluate(state);
  const o = record.outcome;
  if (o.scoutActions !== ev.scoutActions) err(`scoutActions ${o.scoutActions} != replay ${ev.scoutActions}`);
  if (o.runActions !== ev.runActions) err(`runActions ${o.runActions} != replay ${ev.runActions}`);
  if (o.rejectedActions !== parseFailures + ev.rejectedActions) err(`rejectedActions ${o.rejectedActions} != replay ${parseFailures + ev.rejectedActions}`);
  if (o.finalStateHash !== ev.finalStateHash) err('finalStateHash differs from replay');
  if (ev.scoutActions > level.budget.explore) err('scout budget exceeded');
  if (ev.runActions > level.budget.execute) err('run budget exceeded');
  if (o.status === 'won' || o.status === 'lost') {
    if (state.status !== o.status) err(`outcome ${o.status} but replay ends ${state.status}`);
  } else if (state.status !== 'playing') {
    err(`outcome ${o.status} but replay ended ${state.status}`);
  }
  if (o.status === 'forfeit' && o.rejectedActions < (opts.maxRejected ?? 20)) err('forfeit before the rejection cap');

  const t = record.totals;
  const sum = (f: (s: RunRecord['steps'][number]) => number) => record.steps.reduce((a, s) => a + f(s), 0);
  if (t.calls !== record.steps.length) err('totals.calls != number of steps');
  if (t.inputTokens !== sum((s) => s.call.inputTokens)) err('totals.inputTokens != sum of steps');
  if (t.outputTokens !== sum((s) => s.call.outputTokens)) err('totals.outputTokens != sum of steps');
  return { ok: errors.length === 0, errors };
}
