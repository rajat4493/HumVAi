import { describe, expect, it } from 'vitest';
import type { GameAction } from '@hva/game-core';
import { LEVELS, solve } from '@hva/game-core';
import type { ModelAdapter, RunRecord } from '../src';
import { AdapterError, randomLegalAdapter, runAttempt, scriptedAdapter, textAdapter, verifyRecord } from '../src';
import { level, planFor } from './helpers';

const base = { seed: 's', configHash: 'cfg', promptHash: 'ph', runnerVersion: 'test', engineVersion: 'test' };
const play = (l: (typeof LEVELS)[number], adapter: ModelAdapter, extra: Partial<Parameters<typeof runAttempt>[0]> = {}) =>
  runAttempt({ ...base, attemptId: `${l.id}/t`, level: l, adapter, ...extra });

describe('runner against the real engine', () => {
  for (const l of LEVELS) {
    it(`${l.id}: the optimal plan wins and the record independently verifies`, async () => {
      const { record, logs } = await play(l, scriptedAdapter(planFor(l)));
      expect(record.outcome.status).toBe('won');
      expect(record.outcome.runActions).toBe(solve(l).optimalLength);
      expect(verifyRecord(record, l)).toEqual({ ok: true, errors: [] });
      expect(logs).toHaveLength(record.steps.length);
      expect(record.totals.calls).toBe(record.steps.length);
    });
  }

  it('a model that wanders until the run budget ends is recorded as lost and verifies', async () => {
    const l = level('w01');
    const { record } = await play(l, scriptedAdapter(Array.from({ length: 20 }, () => ({ type: 'MOVE', direction: 'LEFT' }) as GameAction)));
    expect(record.outcome.status).toBe('lost');
    expect(record.outcome.runActions).toBe(12);
    expect(verifyRecord(record, l).ok).toBe(true);
  });

  it('malformed replies are free rejected actions; 20 of them forfeit the attempt', async () => {
    const l = level('w02');
    const { record } = await play(l, textAdapter(['I think I should go right.']));
    expect(record.outcome.status).toBe('forfeit');
    expect(record.outcome.rejectedActions).toBe(20);
    expect(record.outcome.scoutActions).toBe(0);
    expect(record.steps.every((s) => s.action === null && !s.valid)).toBe(true);
    expect(verifyRecord(record, l).ok).toBe(true);
  });

  it('engine-rejected actions (not adjacent) are counted, cost nothing, and the model is told why', async () => {
    const l = level('w02');
    const { record, logs } = await play(l, scriptedAdapter([{ type: 'INTERACT', targetId: 'switch-orange' }, ...planFor(l)]));
    expect(record.steps[0]?.valid).toBe(false);
    expect(record.outcome.rejectedActions).toBe(1);
    expect(record.outcome.status).toBe('won');
    expect(logs[1]?.userMessage).toContain('REJECTED: no interactable target adjacent');
    expect(verifyRecord(record, l).ok).toBe(true);
  });

  it('the model never sees hidden rules anywhere in the full conversation', async () => {
    for (const l of LEVELS) {
      const { logs } = await play(l, scriptedAdapter(planFor(l)));
      const all = logs.map((x) => x.userMessage).join('\n').toLowerCase();
      for (const f of ['switchenabled', '"shift"', '"rules"', 'optimal', 'solver']) expect(all, `${l.id} ${f}`).not.toContain(f);
    }
  });

  it('a random legal player never breaks the runner, and every record verifies (300 attempts)', async () => {
    let wins = 0;
    for (let i = 0; i < 300; i++) {
      const l = LEVELS[i % LEVELS.length]!;
      const { record } = await play(l, randomLegalAdapter(i + 1), { seed: `r${i}` });
      expect(['won', 'lost', 'forfeit', 'void']).toContain(record.outcome.status);
      expect(verifyRecord(record, l), `${l.id} #${i}`).toEqual({ ok: true, errors: [] });
      if (record.outcome.status === 'won') wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(0);
  });

  it('adapter failures void the attempt with the error kind, never a loss', async () => {
    const l = level('w01');
    const boom: ModelAdapter = { ...scriptedAdapter([]), async decide() { throw new AdapterError('rate_limit', 'nope'); } };
    const { record } = await play(l, boom);
    expect(record.outcome.status).toBe('void');
    expect(record.outcome.voidReason).toBe('rate_limit');
    expect(verifyRecord(record, l).ok).toBe(true);
  });

  it('a model stuck on the free scouting RESET is stopped by the call cap (void), not left looping', async () => {
    const l = level('w02'); // scouting: RESET is free, so neither budget nor rejection cap can end this loop
    const { record } = await play(l, scriptedAdapter([], { afterEnd: 'reset' }));
    expect(record.outcome.status).toBe('void');
    expect(record.outcome.voidReason).toBe('call-cap');
    expect(record.steps).toHaveLength(16 + 12 + 20 + 10);
    expect(record.outcome.scoutActions).toBe(0);
    expect(verifyRecord(record, l).ok).toBe(true);
  });

  it('a spend cap stops the attempt as void', async () => {
    const l = level('w01');
    const priced: ModelAdapter = {
      identity: { provider: 'test', modelId: 'priced', displayName: 'x' },
      sampling: {},
      async decide() {
        return { raw: '{"action":{"type":"MOVE","direction":"LEFT"}}', usage: { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: null, reasoningTokens: null }, latencyMs: 1, providerRequestId: null, finishReason: 'stop', respondedModel: null, retries: 0 };
      },
    };
    const { record } = await play(l, priced, {
      prices: { 'test:priced': { inputPerMTok: 1, outputPerMTok: 1 } },
      shouldStop: (spent) => (spent !== null && spent >= 2 ? 'spend-cap' : null),
    });
    expect(record.outcome.voidReason).toBe('spend-cap');
    expect(record.steps).toHaveLength(2);
    expect(record.totals.costUsd).toBeCloseTo(2, 6);
  });

  it('flags a response from a different model than requested', async () => {
    const l = level('w01');
    const a = scriptedAdapter(planFor(l));
    const wrapped: ModelAdapter = { ...a, async decide(r, s) { return { ...(await a.decide(r, s)), respondedModel: 'some-other-model' }; } };
    const { record } = await play(l, wrapped);
    expect(record.flags).toContain('model-mismatch');
  });
});

describe('verifier fails on corrupted records (it can fail)', () => {
  const good = async (): Promise<{ r: RunRecord; l: (typeof LEVELS)[number] }> => {
    const l = level('w03');
    return { r: JSON.parse(JSON.stringify((await play(l, scriptedAdapter(planFor(l)))).record)) as RunRecord, l };
  };

  it('changed action', async () => {
    const { r, l } = await good();
    r.steps[3]!.action = { type: 'MOVE', direction: 'UP' };
    expect(verifyRecord(r, l).ok).toBe(false);
  });
  it('changed observation hash', async () => {
    const { r, l } = await good();
    r.steps[2]!.obsHash = 'deadbeef';
    expect(verifyRecord(r, l).errors.join()).toContain('observation hash');
  });
  it('extra action after the end', async () => {
    const { r, l } = await good();
    r.steps.push({ ...r.steps[0]!, i: r.steps.length });
    expect(verifyRecord(r, l).errors.join()).toContain('after the game ended');
  });
  it('wrong scout count', async () => {
    const { r, l } = await good();
    r.outcome.scoutActions += 1;
    expect(verifyRecord(r, l).errors.join()).toContain('scoutActions');
  });
  it('wrong level version', async () => {
    const { r, l } = await good();
    r.challengeVersion = 99;
    expect(verifyRecord(r, l).ok).toBe(false);
  });
  it('truncated steps', async () => {
    const { r, l } = await good();
    r.steps.length = 5;
    expect(verifyRecord(r, l).ok).toBe(false);
  });
  it('tampered outcome claims a win that replay does not show', async () => {
    const { r, l } = await good();
    r.steps.length -= 1;
    r.totals.calls = r.steps.length;
    r.outcome.status = 'won';
    expect(verifyRecord(r, l).ok).toBe(false);
  });
  it('inflated token totals', async () => {
    const { r, l } = await good();
    r.totals.inputTokens += 5;
    expect(verifyRecord(r, l).errors.join()).toContain('inputTokens');
  });
});
