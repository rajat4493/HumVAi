import type { ChallengeDefinition, GameAction, RunAnalysis } from '@hva/game-core';
import { CAMPAIGN_ORDER, earnedFromRun } from '@hva/game-core';
import { DEFAULT_SETTINGS } from './types';
import type { LevelProgress, SaveData, Session, Settings } from './types';

export const emptyProgress = (): LevelProgress => ({ completed: false, attempts: 0, wins: 0, bestRun: null, bestUnassistedRun: null, bestActions: null, firstWonAt: null, usedHints: false });
export const emptySave = (): SaveData => ({ v: 1, levels: {}, achievements: {}, settings: { ...DEFAULT_SETTINGS } });

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
const isAction = (a: unknown): a is GameAction => {
  if (!isObj(a)) return false;
  if (a.type === 'MOVE') return typeof a.direction === 'string' && ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(a.direction);
  if (a.type === 'INTERACT') return typeof a.targetId === 'string';
  return a.type === 'RESET' || a.type === 'COMMIT';
};
export const parseActions = (x: unknown): GameAction[] | null => (Array.isArray(x) && x.length < 5000 && x.every(isAction) ? (x as GameAction[]) : null);

/** Tolerant loader: anything malformed is dropped, never thrown. Unknown future versions are not trusted. */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return emptySave();
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return emptySave();
  }
  if (!isObj(j) || j.v !== 1) return emptySave();
  const out = emptySave();
  if (isObj(j.levels)) {
    for (const [id, v] of Object.entries(j.levels)) {
      if (!isObj(v)) continue;
      out.levels[id] = {
        completed: v.completed === true,
        attempts: num(v.attempts) ?? 0,
        wins: num(v.wins) ?? 0,
        bestRun: num(v.bestRun),
        bestUnassistedRun: num(v.bestUnassistedRun),
        bestActions: parseActions(v.bestActions),
        firstWonAt: typeof v.firstWonAt === 'string' ? v.firstWonAt : null,
        usedHints: v.usedHints === true,
      };
    }
  }
  if (isObj(j.achievements)) {
    for (const [id, v] of Object.entries(j.achievements)) if (isObj(v) && typeof v.at === 'string') out.achievements[id] = { at: v.at, levelId: typeof v.levelId === 'string' ? v.levelId : null };
  }
  if (isObj(j.settings)) {
    const s = j.settings;
    out.settings = {
      sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
      music: typeof s.music === 'boolean' ? s.music : DEFAULT_SETTINGS.music,
      volume: typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1 ? s.volume : DEFAULT_SETTINGS.volume,
      motion: s.motion === 'reduced' || s.motion === 'full' ? s.motion : 'system',
    };
  }
  return out;
}

export function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const j: unknown = JSON.parse(raw);
    if (!isObj(j) || j.v !== 1 || typeof j.levelId !== 'string' || typeof j.levelVersion !== 'number') return null;
    const actions = parseActions(j.actions);
    if (!actions) return null;
    return { v: 1, levelId: j.levelId, levelVersion: j.levelVersion, actions, hintsUsed: Math.min(3, num(j.hintsUsed) ?? 0), startedAt: typeof j.startedAt === 'string' ? j.startedAt : new Date(0).toISOString() };
  } catch {
    return null;
  }
}

export const progressOf = (s: SaveData, id: string): LevelProgress => s.levels[id] ?? emptyProgress();

/**
 * A world is playable when it is first in the campaign, the previous one is completed, or it (or any later world) is already
 * completed. The last clause keeps older saves playable when levels are inserted before worlds they had finished.
 */
export function isUnlocked(s: SaveData, id: string, opts: { unlockAll?: boolean } = {}): boolean {
  if (opts.unlockAll) return true;
  const i = CAMPAIGN_ORDER.indexOf(id);
  if (i < 0) return false;
  return i === 0 || progressOf(s, CAMPAIGN_ORDER[i - 1] as string).completed || CAMPAIGN_ORDER.slice(i).some((x) => progressOf(s, x).completed);
}

export const completedCount = (s: SaveData): number => CAMPAIGN_ORDER.filter((id) => progressOf(s, id).completed).length;

export interface WinResult {
  save: SaveData;
  newBestRun: boolean;
  newUnassistedBest: boolean;
  isOptimal: boolean;
  /** Achievement ids earned for the first time by this run. */
  newAchievements: string[];
}

/** Applies a verified win. `analysis` must come from replaying `actions` through the engine. */
export function recordWin(
  save: SaveData,
  args: { level: ChallengeDefinition; actions: GameAction[]; analysis: RunAnalysis; hintsUsed: number; optimalLength: number; now: Date },
): WinResult {
  const { level, actions, analysis, hintsUsed, optimalLength, now } = args;
  const next: SaveData = JSON.parse(JSON.stringify(save)) as SaveData;
  const p = next.levels[level.id] ?? emptyProgress();
  const run = analysis.outcome.runActions;
  const assisted = hintsUsed > 0;
  p.attempts += 1;
  p.wins += 1;
  p.completed = true;
  p.firstWonAt ??= now.toISOString();
  p.usedHints ||= assisted;
  const newBestRun = p.bestRun === null || run < p.bestRun;
  if (newBestRun) p.bestRun = run;
  const newUnassistedBest = !assisted && (p.bestUnassistedRun === null || run < p.bestUnassistedRun);
  if (newUnassistedBest) {
    p.bestUnassistedRun = run;
    p.bestActions = actions;
  }
  next.levels[level.id] = p;

  const earned = earnedFromRun({ levelId: level.id, analysis, optimalLength, hintsUsed });
  const unassistedWins = Object.values(next.levels).filter((l) => l.bestUnassistedRun !== null).length;
  if (unassistedWins >= 3) earned.push('no-help');
  if (CAMPAIGN_ORDER.every((id) => next.levels[id]?.completed)) earned.push('every-world');
  const fresh = earned.filter((id) => !next.achievements[id]);
  for (const id of fresh) next.achievements[id] = { at: now.toISOString(), levelId: level.id };
  return { save: next, newBestRun, newUnassistedBest, isOptimal: !assisted && run === optimalLength, newAchievements: fresh };
}

export function recordLoss(save: SaveData, levelId: string): SaveData {
  const next: SaveData = JSON.parse(JSON.stringify(save)) as SaveData;
  const p = next.levels[levelId] ?? emptyProgress();
  p.attempts += 1;
  next.levels[levelId] = p;
  return next;
}

export const withSettings = (s: SaveData, patch: Partial<Settings>): SaveData => ({ ...s, settings: { ...s.settings, ...patch } });
