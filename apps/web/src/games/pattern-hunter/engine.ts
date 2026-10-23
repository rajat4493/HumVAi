/**
 * Pattern Hunter's rules engine. Pure, deterministic, and deliberately independent of The Experiment: it imports nothing
 * from the grid engine, the campaign, the save or any UI (a test enforces this). A run is fully described by its probes
 * and predictions, so any result can be re-derived and checked by anyone holding the log.
 */
export interface PhExample {
  n: number;
  fits: boolean;
}

export interface PhChallenge {
  id: string;
  version: number;
  title: string;
  briefing: string;
  /** Inclusive range of numbers in play. */
  min: number;
  max: number;
  /** Shown to the player up front. */
  examples: PhExample[];
  /** How many numbers the player may test before predicting. */
  probeBudget: number;
  /** The numbers the player must classify at the end. Never shown as examples. */
  holdout: number[];
  /** The hidden rule. */
  fits: (n: number) => boolean;
  /** Plain-words rule, shown only after the player has submitted. */
  ruleText: string;
  /** Plausible wrong rules. Each agrees with every example but is wrong on at least one holdout number (tested). */
  decoys: { text: string; fits: (n: number) => boolean }[];
}

export type PhPhase = 'explore' | 'predict' | 'done';

export interface PhRun {
  challengeId: string;
  challengeVersion: number;
  phase: PhPhase;
  /** Numbers tested, in order. */
  probes: number[];
  /** What each probe revealed (derived, kept for display). */
  revealed: Record<number, boolean>;
  /** Predictions per holdout number; unset until answered. */
  predictions: Record<number, boolean>;
  result: PhResult | null;
}

export interface PhResult {
  correct: number;
  total: number;
  solved: boolean;
  probesUsed: number;
  /** For each holdout number: what the player said and what is true. */
  items: { n: number; said: boolean; truth: boolean; right: boolean }[];
}

export const CHALLENGES: readonly PhChallenge[] = [
  {
    id: 'ph-001',
    version: 1,
    title: 'The Gate',
    briefing: 'A gate lets some numbers through. Six examples are shown. You may test a few more numbers, then predict what the gate does with six new ones.',
    min: 1,
    max: 40,
    // Every example is consistent with the simple guesses ("odd", "over 10"); only testing separates the real rule from them.
    examples: [
      { n: 13, fits: true },
      { n: 21, fits: true },
      { n: 35, fits: true },
      { n: 2, fits: false },
      { n: 6, fits: false },
      { n: 10, fits: false },
    ],
    probeBudget: 6,
    holdout: [7, 20, 15, 38, 9, 27],
    fits: (n) => n % 2 === 1 && n > 10,
    ruleText: 'The gate lets through odd numbers that are bigger than 10.',
    decoys: [
      { text: 'odd numbers', fits: (n) => n % 2 === 1 },
      { text: 'numbers bigger than 10', fits: (n) => n > 10 },
      { text: 'numbers bigger than 10 that are not multiples of 4', fits: (n) => n > 10 && n % 4 !== 0 },
    ],
  },
];

export const challengeById = (id: string): PhChallenge | undefined => CHALLENGES.find((c) => c.id === id);

export const newRun = (c: PhChallenge): PhRun => ({ challengeId: c.id, challengeVersion: c.version, phase: 'explore', probes: [], revealed: {}, predictions: {}, result: null });

const isExample = (c: PhChallenge, n: number): boolean => c.examples.some((e) => e.n === n);

export type PhError = 'wrong-phase' | 'out-of-range' | 'already-known' | 'no-probes-left' | 'not-a-holdout-number' | 'incomplete';

/** Tests one number. Examples and already-tested numbers cannot be tested again. Costs one probe. */
export function probe(c: PhChallenge, run: PhRun, n: number): { run: PhRun } | { error: PhError } {
  if (run.phase !== 'explore') return { error: 'wrong-phase' };
  if (!Number.isInteger(n) || n < c.min || n > c.max) return { error: 'out-of-range' };
  if (isExample(c, n) || run.probes.includes(n)) return { error: 'already-known' };
  if (run.probes.length >= c.probeBudget) return { error: 'no-probes-left' };
  return { run: { ...run, probes: [...run.probes, n], revealed: { ...run.revealed, [n]: c.fits(n) } } };
}

export function startPrediction(run: PhRun): { run: PhRun } | { error: PhError } {
  return run.phase === 'explore' ? { run: { ...run, phase: 'predict' } } : { error: 'wrong-phase' };
}

export function predict(c: PhChallenge, run: PhRun, n: number, says: boolean): { run: PhRun } | { error: PhError } {
  if (run.phase !== 'predict') return { error: 'wrong-phase' };
  if (!c.holdout.includes(n)) return { error: 'not-a-holdout-number' };
  return { run: { ...run, predictions: { ...run.predictions, [n]: says } } };
}

export function submit(c: PhChallenge, run: PhRun): { run: PhRun } | { error: PhError } {
  if (run.phase !== 'predict') return { error: 'wrong-phase' };
  if (c.holdout.some((n) => run.predictions[n] === undefined)) return { error: 'incomplete' };
  const items = c.holdout.map((n) => {
    const said = run.predictions[n] as boolean;
    const truth = c.fits(n);
    return { n, said, truth, right: said === truth };
  });
  const correct = items.filter((i) => i.right).length;
  return { run: { ...run, phase: 'done', result: { correct, total: items.length, solved: correct === items.length, probesUsed: run.probes.length, items } } };
}

/** What a run is reduced to for storage, sharing and checking: just the choices the player made. */
export interface PhLog {
  challengeId: string;
  challengeVersion: number;
  probes: number[];
  predictions: Record<number, boolean>;
}

export const logOf = (run: PhRun): PhLog => ({ challengeId: run.challengeId, challengeVersion: run.challengeVersion, probes: [...run.probes], predictions: { ...run.predictions } });

/** Re-derives a result from a log alone. Returns null when the log breaks a rule (so a claimed result can be rejected). */
export function verifyLog(log: PhLog): PhResult | null {
  const c = challengeById(log.challengeId);
  if (!c || c.version !== log.challengeVersion) return null;
  let run = newRun(c);
  for (const n of log.probes) {
    const r = probe(c, run, n);
    if ('error' in r) return null;
    run = r.run;
  }
  const s = startPrediction(run);
  if ('error' in s) return null;
  run = s.run;
  for (const n of c.holdout) {
    if (typeof log.predictions[n] !== 'boolean') return null;
    const p = predict(c, run, n, log.predictions[n] as boolean);
    if ('error' in p) return null;
    run = p.run;
  }
  const done = submit(c, run);
  return 'error' in done ? null : (done.run.result as PhResult);
}
