import { describe, expect, it } from 'vitest';
import type { GameAction } from '@hva/game-core';
import { LEVELS, solve } from '@hva/game-core';
import type { ModelAdapter, RunRecord } from '../src';
import { SCHEMA_OPPONENT, buildOpponent, checkOpponent, compareHeadToHead, gridDistanceToExit, randomLegalAdapter, runAttempt, scriptedAdapter, selectShownAttempt, verifyRecord } from '../src';
import { level, planFor } from './helpers';

describe('compareHeadToHead (the published rule)', () => {
  const side = (won: boolean, runActions: number, scoutActions = 0) => ({ won, runActions, scoutActions });
  const cases: [string, ReturnType<typeof side>, ReturnType<typeof side> | null, boolean, string, string][] = [
    ['human reaches the exit, AI does not', side(true, 9), side(false, 12), false, 'HUMAN_AHEAD', 'outcome'],
    ['AI reaches the exit, human does not', side(false, 12), side(true, 9), false, 'AI_AHEAD', 'outcome'],
    ['both reach it, human needs fewer run actions', side(true, 9, 20), side(true, 11, 1), false, 'HUMAN_AHEAD', 'run'],
    ['both reach it, AI needs fewer run actions', side(true, 11), side(true, 9), false, 'AI_AHEAD', 'run'],
    ['equal run actions, human scouted less', side(true, 9, 3), side(true, 9, 7), false, 'HUMAN_AHEAD', 'scout'],
    ['equal run actions, AI scouted less', side(true, 9, 7), side(true, 9, 3), false, 'AI_AHEAD', 'scout'],
    ['equal on everything is a tie', side(true, 9, 4), side(true, 9, 4), false, 'TIE', 'none'],
    ['neither reaches the exit is both-failed, never a tie', side(false, 12), side(false, 12), false, 'BOTH_FAILED', 'none'],
    ['no verified AI record is inconclusive, never a human win', side(true, 9), null, false, 'INCONCLUSIVE', 'none'],
    ['a hinted human run gets no verdict even when it would win', side(true, 8), side(true, 11), true, 'ASSISTED', 'none'],
    ['a hinted run with no AI record is still inconclusive (nothing to compare)', side(true, 8), null, true, 'INCONCLUSIVE', 'none'],
  ];
  for (const [name, human, ai, assisted, outcome, decidedBy] of cases) {
    it(name, () => expect(compareHeadToHead(human, ai, { humanAssisted: assisted })).toEqual({ outcome, decidedBy }));
  }
});

const record = async (l: (typeof LEVELS)[number], adapter: ModelAdapter, n: number): Promise<RunRecord> =>
  (await runAttempt({ attemptId: `${l.id}/${n}`, seed: `s${n}`, level: l, adapter, configHash: 'cfg', promptHash: 'ph', runnerVersion: 't', engineVersion: 't' })).record;

/** A scripted win that wastes `extra` actions bumping into the wall first (so run length = optimal + extra). */
const slowWin = async (l: (typeof LEVELS)[number], extra: number, n: number) => {
  const plan = planFor(l);
  const bumps: GameAction[] = Array.from({ length: extra }, () => ({ type: 'MOVE', direction: 'UP' }) as GameAction);
  const commitAt = plan.findIndex((a) => a.type === 'COMMIT');
  const actions = commitAt >= 0 ? [...plan.slice(0, commitAt + 1), ...bumps, ...plan.slice(commitAt + 1)] : [...bumps, ...plan];
  return record(l, scriptedAdapter(actions), n);
};

describe('shown-attempt selection and opponent recordings', () => {
  const l = level('w01');

  it('picks the median successful attempt (lower median, lowest attempt number on ties)', async () => {
    const recs = [await slowWin(l, 0, 1), await slowWin(l, 3, 2), await slowWin(l, 1, 3), await slowWin(l, 1, 4)];
    const sel = selectShownAttempt(recs, l)!;
    expect(sel.rule).toBe('median-success');
    expect(recs[sel.index]!.outcome.runActions).toBe(9); // runs are 8, 11, 9, 9 -> sorted 8,9,9,11 -> lower median 9
    expect(sel.index).toBe(2); // the first attempt with that value
  });

  it('ignores voids and unverifiable records', async () => {
    const good = await slowWin(l, 0, 1);
    const broken: RunRecord = JSON.parse(JSON.stringify(await slowWin(l, 2, 2))) as RunRecord;
    broken.outcome.runActions = 1;
    const voided: RunRecord = { ...(await slowWin(l, 0, 3)), outcome: { ...good.outcome, status: 'void', voidReason: 'x' } };
    expect(selectShownAttempt([broken, voided, good], l)?.index).toBe(2);
    expect(selectShownAttempt([broken, voided], l)).toBeNull();
  });

  it('when nobody reached the exit it picks the attempt that ended nearest it, labelled closest-failure', async () => {
    const far = await record(l, scriptedAdapter(Array.from({ length: 12 }, () => ({ type: 'MOVE', direction: 'LEFT' }) as GameAction)), 1);
    const nearActions: GameAction[] = [...'RRDDRR'].map((c) => ({ type: 'MOVE', direction: ({ R: 'RIGHT', D: 'DOWN' } as const)[c as 'R'] }) as GameAction);
    const near = await record(l, scriptedAdapter([...nearActions, ...Array.from({ length: 6 }, () => ({ type: 'MOVE', direction: 'DOWN' }) as GameAction)]), 2);
    expect(far.outcome.status).toBe('lost');
    expect(near.outcome.status).toBe('lost');
    const sel = selectShownAttempt([far, near], l)!;
    expect(sel).toEqual({ index: 1, rule: 'closest-failure' });
    expect(gridDistanceToExit(l, { x: 1, y: 1 })).toBe(8);
  });

  it('builds a recording whose context is honest, and which passes its own check', async () => {
    const recs = [await slowWin(l, 0, 1), await slowWin(l, 1, 2), await slowWin(l, 2, 3), await record(l, randomLegalAdapter(3), 4)];
    const o = buildOpponent(recs, l, { kind: 'reference', now: new Date('2026-01-01T00:00:00Z') })!;
    expect(o.schema).toBe(SCHEMA_OPPONENT);
    expect(o.attempts.map((a) => a.status)).toEqual(recs.map((r) => r.outcome.status));
    expect(o.shown.outcome.runActions).toBe(9);
    expect(o.shownAttempt).toBe(2);
    expect(o.model.displayName).toMatch(/not an AI/);
    expect(checkOpponent(o, l)).toEqual({ ok: true, errors: [] });
  });

  it('refuses records from different configurations or worlds', async () => {
    const a = await slowWin(l, 0, 1);
    const b = { ...(await slowWin(l, 0, 2)), configHash: 'other' };
    expect(() => buildOpponent([a, b], l, { kind: 'reference', now: new Date() })).toThrow();
  });

  describe('checkOpponent rejects anything that cannot be shown honestly', () => {
    const build = async () => buildOpponent([await slowWin(l, 0, 1), await slowWin(l, 1, 2), await slowWin(l, 2, 3)], l, { kind: 'reference', now: new Date() })!;
    const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

    it('tampered shown attempt', async () => {
      const o = clone(await build());
      o.shown.steps[2]!.action = { type: 'MOVE', direction: 'UP' };
      expect(checkOpponent(o, l).ok).toBe(false);
    });
    it('stale world version', async () => {
      const o = clone(await build());
      expect(checkOpponent(o, { ...l, version: l.version + 1 }).errors.join()).toContain('version');
    });
    it('different world', async () => {
      expect(checkOpponent(await build(), level('w02')).ok).toBe(false);
    });
    it('shown attempt that violates the selection rule', async () => {
      const o = clone(await build());
      o.shownAttempt = 3;
      o.shown = clone((await build()).shown);
      expect(checkOpponent(o, l).ok).toBe(false);
    });
    it('a reference player that is not labelled as such', async () => {
      const o = clone(await build());
      o.model.displayName = 'GPT-ish model';
      expect(checkOpponent(o, l).errors.join()).toContain('not an AI');
    });
    it('a model recording carrying a test identity', async () => {
      const o = clone(await build());
      o.kind = 'model';
      expect(checkOpponent(o, l).errors.join()).toContain('cannot carry a reference/test identity');
    });
    it('garbage', () => {
      expect(checkOpponent(null, l).ok).toBe(false);
      expect(checkOpponent({ schema: 'x' }, l).ok).toBe(false);
    });
  });

  it('sanity: the optimal scripted record verifies on every level', async () => {
    for (const lv of LEVELS) {
      const r = await record(lv, scriptedAdapter(planFor(lv)), 1);
      expect(verifyRecord(r, lv).ok).toBe(true);
      expect(r.outcome.runActions).toBe(solve(lv).optimalLength);
    }
  });
});
