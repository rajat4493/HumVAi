import type { GameProgress } from '../../suite/contract';

/** Pattern Hunter's own record, separate from The Experiment's save, so adding or removing it can never touch a campaign. */
export const PH_KEY = 'hva.ph.v1';

export interface PhChallengeRecord {
  attempts: number;
  solved: boolean;
  /** Best number of held-out predictions right. */
  bestCorrect: number;
  total: number;
  /** Fewest probes used in a perfect attempt. */
  fewestProbes: number | null;
}
export interface PhSave {
  v: 1;
  challenges: Record<string, PhChallengeRecord>;
}

export const emptyPh = (): PhSave => ({ v: 1, challenges: {} });

export function parsePh(raw: string | null): PhSave {
  if (!raw) return emptyPh();
  try {
    const v = JSON.parse(raw) as Partial<PhSave>;
    if (v.v !== 1 || typeof v.challenges !== 'object' || v.challenges === null) return emptyPh();
    const out = emptyPh();
    for (const [id, r] of Object.entries(v.challenges)) {
      const x = r as Partial<PhChallengeRecord>;
      if (typeof x.attempts === 'number' && typeof x.solved === 'boolean' && typeof x.bestCorrect === 'number' && typeof x.total === 'number') {
        out.challenges[id] = { attempts: x.attempts, solved: x.solved, bestCorrect: x.bestCorrect, total: x.total, fewestProbes: typeof x.fewestProbes === 'number' ? x.fewestProbes : null };
      }
    }
    return out;
  } catch {
    return emptyPh();
  }
}

const read = (): PhSave => {
  try {
    return parsePh(typeof localStorage === 'undefined' ? null : localStorage.getItem(PH_KEY));
  } catch {
    return emptyPh();
  }
};
const write = (s: PhSave): void => {
  try {
    localStorage.setItem(PH_KEY, JSON.stringify(s));
  } catch {
    /* blocked or full: the result is simply not remembered */
  }
};

export const loadPh = read;

export function recordPhResult(challengeId: string, r: { correct: number; total: number; probes: number }): PhSave {
  const s = read();
  const prev = s.challenges[challengeId] ?? { attempts: 0, solved: false, bestCorrect: 0, total: r.total, fewestProbes: null };
  const solved = r.correct === r.total;
  s.challenges[challengeId] = {
    attempts: prev.attempts + 1,
    solved: prev.solved || solved,
    bestCorrect: Math.max(prev.bestCorrect, r.correct),
    total: r.total,
    fewestProbes: solved ? (prev.fewestProbes === null ? r.probes : Math.min(prev.fewestProbes, r.probes)) : prev.fewestProbes,
  };
  write(s);
  return s;
}

/** Small and dependency-free on purpose: the home screen reads it without loading the game. */
export function phProgress(): GameProgress | null {
  const recs = Object.values(read().challenges);
  if (recs.length === 0) return null;
  const solved = recs.filter((r) => r.solved).length;
  return { label: solved > 0 ? 'Prototype: solved' : `Prototype: ${recs.reduce((n, r) => n + r.attempts, 0)} attempt${recs.length === 1 && recs[0]!.attempts === 1 ? '' : 's'}`, started: true };
}
