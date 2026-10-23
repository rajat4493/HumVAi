import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHALLENGES, challengeById, logOf, newRun, predict, probe, startPrediction, submit, verifyLog } from './engine';
import type { PhChallenge, PhRun } from './engine';

const c = challengeById('ph-001') as PhChallenge;
const ok = (r: { run: PhRun } | { error: string }): PhRun => {
  if ('error' in r) throw new Error(r.error);
  return r.run;
};
const playTruthfully = (probes: number[]): PhRun => {
  let run = newRun(c);
  for (const n of probes) run = ok(probe(c, run, n));
  run = ok(startPrediction(run));
  for (const n of c.holdout) run = ok(predict(c, run, n, c.fits(n)));
  return ok(submit(c, run));
};

describe('challenge design (the puzzle is real, not guessable from the examples)', () => {
  it.each(CHALLENGES.map((x) => [x.id, x] as const))('%s: examples follow the rule, and every decoy agrees with all examples', (_, ch) => {
    for (const e of ch.examples) expect(ch.fits(e.n), `example ${e.n}`).toBe(e.fits);
    for (const d of ch.decoys) for (const e of ch.examples) expect(d.fits(e.n), `${d.text} on example ${e.n}`).toBe(e.fits);
  });

  it.each(CHALLENGES.map((x) => [x.id, x] as const))('%s: every decoy is wrong on at least one held-out number, and held-out numbers are not examples', (_, ch) => {
    for (const d of ch.decoys) expect(ch.holdout.some((n) => d.fits(n) !== ch.fits(n)), d.text).toBe(true);
    for (const n of ch.holdout) {
      expect(ch.examples.some((e) => e.n === n)).toBe(false);
      expect(n >= ch.min && n <= ch.max).toBe(true);
    }
  });

  it('the probes can separate the real rule from every decoy within the budget', () => {
    // a probe set that is wrong for decoy d on some number, for each decoy, must fit the budget
    const needed = new Set<number>();
    for (const d of c.decoys) {
      const n = Array.from({ length: c.max - c.min + 1 }, (_, i) => c.min + i).find((x) => !c.examples.some((e) => e.n === x) && d.fits(x) !== c.fits(x));
      expect(n).toBeDefined();
      needed.add(n as number);
    }
    expect(needed.size).toBeLessThanOrEqual(c.probeBudget);
  });

  it('guessing without testing cannot reliably win: the "odd" and "over 10" guesses both fail', () => {
    for (const d of c.decoys) {
      let run = ok(startPrediction(newRun(c)));
      for (const n of c.holdout) run = ok(predict(c, run, n, d.fits(n)));
      expect(ok(submit(c, run)).result!.solved, d.text).toBe(false);
    }
  });
});

describe('rules of play', () => {
  it('testing reveals the truth, costs a probe, and refuses repeats, examples, out-of-range numbers and overspending', () => {
    let run = newRun(c);
    run = ok(probe(c, run, 7));
    expect(run.revealed[7]).toBe(false);
    expect(run.probes).toEqual([7]);
    expect(probe(c, run, 7)).toEqual({ error: 'already-known' });
    expect(probe(c, run, 13)).toEqual({ error: 'already-known' });
    expect(probe(c, run, 0)).toEqual({ error: 'out-of-range' });
    expect(probe(c, run, 41)).toEqual({ error: 'out-of-range' });
    for (const n of [1, 3, 4, 5, 8]) run = ok(probe(c, run, n));
    expect(probe(c, run, 9)).toEqual({ error: 'no-probes-left' });
  });

  it('phases are enforced: no probing while predicting, no submitting early', () => {
    let run = ok(startPrediction(newRun(c)));
    expect(probe(c, run, 7)).toEqual({ error: 'wrong-phase' });
    expect(submit(c, run)).toEqual({ error: 'incomplete' });
    expect(predict(c, run, 12, true)).toEqual({ error: 'not-a-holdout-number' });
    run = ok(predict(c, run, 7, false));
    expect(submit(c, run)).toEqual({ error: 'incomplete' });
  });

  it('answering every held-out number correctly solves it; one wrong does not', () => {
    const perfect = playTruthfully([7, 20, 16]);
    expect(perfect.result).toMatchObject({ correct: 6, total: 6, solved: true, probesUsed: 3 });
    let run = ok(startPrediction(newRun(c)));
    for (const n of c.holdout) run = ok(predict(c, run, n, n === 15 ? !c.fits(n) : c.fits(n)));
    const lost = ok(submit(c, run)).result!;
    expect(lost).toMatchObject({ correct: 5, solved: false });
    expect(lost.items.find((i) => i.n === 15)).toMatchObject({ right: false });
  });
});

describe('verification: a result can be re-derived from the log alone', () => {
  it('a real run verifies to the same result', () => {
    const run = playTruthfully([7, 20]);
    expect(verifyLog(logOf(run))).toEqual(run.result);
  });
  it('rejects overspent probes, repeated probes, missing predictions, and an unknown or changed challenge', () => {
    const base = logOf(playTruthfully([7, 20]));
    expect(verifyLog({ ...base, probes: [1, 3, 4, 5, 8, 9, 11] })).toBeNull();
    expect(verifyLog({ ...base, probes: [7, 7] })).toBeNull();
    expect(verifyLog({ ...base, probes: [13] })).toBeNull();
    const rest = { ...base.predictions };
    delete rest[7];
    expect(verifyLog({ ...base, predictions: rest })).toBeNull();
    expect(verifyLog({ ...base, challengeId: 'nope' })).toBeNull();
    expect(verifyLog({ ...base, challengeVersion: 2 })).toBeNull();
  });
  it('a claimed score cannot be inflated: the verifier recomputes it', () => {
    const base = logOf(playTruthfully([7]));
    const wrong = { ...base, predictions: { ...base.predictions, 15: !c.fits(15) } };
    expect(verifyLog(wrong)!.correct).toBe(5);
  });
});

describe('independence from The Experiment (the architectural proof)', () => {
  it('no Pattern Hunter source file imports the grid engine, the campaign, the save or the Experiment screens', () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(2);
    for (const f of files) {
      const text = readFileSync(join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/@hva\/game-core|@hva\/ai-adapters|games\/experiment|\.\.\/\.\.\/screens|\.\.\/\.\.\/save\//);
    }
  });
});
