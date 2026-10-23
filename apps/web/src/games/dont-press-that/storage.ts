import type { GameProgress } from '../../suite/contract';
import type { Tone } from './lines';

/** DON'T PRESS THAT's own save: progress and settings. Separate from every other game, so removing it can never touch a campaign. */
export const DPT_KEY = 'hva.dpt.v1';
export const LEVEL_COUNT = 5;

export interface DptLevelRecord {
  attempts: number;
  deaths: number;
  cleared: boolean;
  skipped: boolean;
  /** Fewest ticks in a winning attempt. */
  bestTicks: number | null;
  /** Fewest deaths before a clear. */
  fewestDeaths: number | null;
  hintsUsed: number;
}
export interface DptFeedback {
  level: number;
  fair: 'fair' | 'unfair' | 'skip';
  fun: 'fun' | 'meh' | 'skip';
}
export interface DptSettings {
  tone: Tone;
  muted: boolean;
  shake: boolean;
}
export interface DptSave {
  v: 1;
  settings: DptSettings;
  levels: Record<string, DptLevelRecord>;
  predictions: { correct: number; wrong: number };
  finished: boolean;
  feedback: DptFeedback[];
}

export const DEFAULT_DPT_SETTINGS: DptSettings = { tone: 'playful', muted: false, shake: true };
export const emptyDpt = (): DptSave => ({ v: 1, settings: { ...DEFAULT_DPT_SETTINGS }, levels: {}, predictions: { correct: 0, wrong: 0 }, finished: false, feedback: [] });
export const emptyLevel = (): DptLevelRecord => ({ attempts: 0, deaths: 0, cleared: false, skipped: false, bestTicks: null, fewestDeaths: null, hintsUsed: 0 });

const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : d);

export function parseDpt(raw: string | null): DptSave {
  if (!raw) return emptyDpt();
  try {
    const v = JSON.parse(raw) as Partial<DptSave>;
    if (v.v !== 1 || typeof v.levels !== 'object' || v.levels === null) return emptyDpt();
    const out = emptyDpt();
    const s = (v.settings ?? {}) as Partial<DptSettings>;
    out.settings = {
      tone: s.tone === 'edge' || s.tone === 'chaos' ? s.tone : 'playful',
      muted: s.muted === true,
      shake: s.shake !== false,
    };
    for (const [id, r] of Object.entries(v.levels)) {
      const x = r as Partial<DptLevelRecord>;
      out.levels[id] = {
        attempts: num(x.attempts),
        deaths: num(x.deaths),
        cleared: x.cleared === true,
        skipped: x.skipped === true,
        bestTicks: typeof x.bestTicks === 'number' ? num(x.bestTicks) : null,
        fewestDeaths: typeof x.fewestDeaths === 'number' ? num(x.fewestDeaths) : null,
        hintsUsed: num(x.hintsUsed),
      };
    }
    out.predictions = { correct: num(v.predictions?.correct), wrong: num(v.predictions?.wrong) };
    out.finished = v.finished === true;
    out.feedback = Array.isArray(v.feedback)
      ? v.feedback
          .filter((f): f is DptFeedback => !!f && typeof f.level === 'number' && ['fair', 'unfair', 'skip'].includes(f.fair) && ['fun', 'meh', 'skip'].includes(f.fun))
          .slice(-50)
      : [];
    return out;
  } catch {
    return emptyDpt();
  }
}

export const loadDpt = (): DptSave => {
  try {
    return parseDpt(typeof localStorage === 'undefined' ? null : localStorage.getItem(DPT_KEY));
  } catch {
    return emptyDpt();
  }
};
export const saveDpt = (s: DptSave): void => {
  try {
    localStorage.setItem(DPT_KEY, JSON.stringify(s));
  } catch {
    /* blocked or full: progress is simply not remembered */
  }
};
const update = (fn: (s: DptSave) => void): DptSave => {
  const s = loadDpt();
  fn(s);
  saveDpt(s);
  return s;
};

export const setSettings = (p: Partial<DptSettings>): DptSave => update((s) => void (s.settings = { ...s.settings, ...p }));

/** Level ids are the level's own id; `n` is its place in the line. */
export const recordAttempt = (levelId: string, o: { died: boolean }): DptSave =>
  update((s) => {
    const r = (s.levels[levelId] ??= emptyLevel());
    r.attempts++;
    if (o.died) r.deaths++;
  });
export const recordClear = (levelId: string, ticks: number, deathsBeforeClear: number): DptSave =>
  update((s) => {
    const r = (s.levels[levelId] ??= emptyLevel());
    r.cleared = true;
    r.bestTicks = r.bestTicks === null ? ticks : Math.min(r.bestTicks, ticks);
    r.fewestDeaths = r.fewestDeaths === null ? deathsBeforeClear : Math.min(r.fewestDeaths, deathsBeforeClear);
  });
export const recordSkip = (levelId: string): DptSave =>
  update((s) => {
    const r = (s.levels[levelId] ??= emptyLevel());
    r.skipped = true;
  });
export const recordHint = (levelId: string): DptSave =>
  update((s) => {
    const r = (s.levels[levelId] ??= emptyLevel());
    r.hintsUsed++;
  });
export const addPredictions = (correct: number, wrong: number): DptSave =>
  update((s) => {
    s.predictions.correct += correct;
    s.predictions.wrong += wrong;
  });
export const markFinished = (): DptSave => update((s) => void (s.finished = true));
export const addFeedback = (f: DptFeedback): DptSave => update((s) => void (s.feedback = [...s.feedback, f].slice(-50)));
export const resetDpt = (): DptSave => {
  const s = emptyDpt();
  const old = loadDpt();
  s.settings = old.settings; // erasing progress keeps your settings
  saveDpt(s);
  return s;
};

/** Which level may be played next: the first not yet cleared or skipped; all unlocked once finished. */
export function unlockedUpTo(s: DptSave, ids: readonly string[]): number {
  let n = 1;
  for (let i = 0; i < ids.length; i++) {
    const r = s.levels[ids[i]!];
    if (r && (r.cleared || r.skipped)) n = i + 2;
    else break;
  }
  return Math.min(ids.length, n);
}

/** Small and dependency-free: the home screen reads it without loading the game. */
export function dptProgress(): GameProgress | null {
  const s = loadDpt();
  const cleared = Object.values(s.levels).filter((r) => r.cleared).length;
  const attempts = Object.values(s.levels).reduce((n, r) => n + r.attempts, 0);
  if (attempts === 0) return null;
  return { label: s.finished ? 'Beat the host' : `${cleared} of ${LEVEL_COUNT} levels cleared`, started: true, fraction: cleared / LEVEL_COUNT };
}

/**
 * A plain-text summary a tester can paste into a form: numbers and the settings used, nothing typed by the player, nothing sent
 * anywhere by the game. The player chooses whether to copy it and where to paste it.
 */
export function resultsText(s: DptSave, ids: readonly string[], names: readonly string[]): string {
  const lines = [`DON'T PRESS THAT playtest results (slice-0.1)`, `host: ${s.settings.muted ? 'muted' : s.settings.tone}`];
  ids.forEach((id, i) => {
    const r = s.levels[id];
    lines.push(`L${i + 1} ${names[i]}: ${r ? `${r.cleared ? 'cleared' : r.skipped ? 'skipped' : 'not cleared'}, ${r.attempts} attempts, ${r.deaths} deaths, ${r.hintsUsed} hints` : 'not played'}`);
  });
  const fb = s.feedback;
  const count = (f: (x: DptFeedback) => boolean): number => fb.filter(f).length;
  lines.push(`feedback: fair ${count((x) => x.fair === 'fair')}, unfair ${count((x) => x.fair === 'unfair')}, fun ${count((x) => x.fun === 'fun')}, meh ${count((x) => x.fun === 'meh')}`);
  lines.push(`host predictions: ${s.predictions.correct} came true, ${s.predictions.wrong} did not`);
  lines.push(`finished: ${s.finished ? 'yes' : 'no'}`);
  return lines.join('\n');
}
