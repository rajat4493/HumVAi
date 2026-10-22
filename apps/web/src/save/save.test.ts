import { describe, expect, it } from 'vitest';
import type { GameAction } from '@hva/game-core';
import { CAMPAIGN_ORDER, analyzeRun, levelById, solve } from '@hva/game-core';
import { completedCount, emptySave, isUnlocked, parseSave, parseSession, recordLoss, recordWin, withSettings } from './save';
import { SaveStore, pickStorage } from './store';
import { SAVE_KEY, SESSION_KEY } from './types';

const level = (id: string) => levelById(id)!;
const win = (save: ReturnType<typeof emptySave>, id: string, hints = 0, extra: GameAction[] = []) => {
  const l = level(id);
  const opt = solve(l).optimalSolution as GameAction[];
  const actions: GameAction[] = [...(l.budget.explore > 0 ? [{ type: 'COMMIT' } as GameAction] : []), ...extra, ...opt];
  return recordWin(save, { level: l, actions, analysis: analyzeRun(l, actions), hintsUsed: hints, optimalLength: opt.length, now: new Date('2026-01-01T00:00:00Z') });
};
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe('save data', () => {
  it('starts empty with sensible settings, and only the first world unlocked', () => {
    const s = emptySave();
    expect(s.settings).toEqual({ sound: true, music: true, volume: 0.7, motion: 'system' });
    expect(isUnlocked(s, 'w01-first-steps')).toBe(true);
    expect(isUnlocked(s, 'w02-orange-switch')).toBe(false);
    expect(isUnlocked(s, 'w02-orange-switch', { unlockAll: true })).toBe(true);
    expect(isUnlocked(s, 'nope')).toBe(false);
  });

  it('a win unlocks the next world and records bests, the replayable log, and achievements', () => {
    const r = win(emptySave(), 'w01-first-steps');
    expect(isUnlocked(r.save, 'w02-orange-switch')).toBe(true);
    const p = r.save.levels['w01-first-steps']!;
    expect(p).toMatchObject({ completed: true, wins: 1, attempts: 1, bestRun: 8, bestUnassistedRun: 8 });
    expect(p.bestActions).toHaveLength(8);
    expect(r.isOptimal).toBe(true);
    expect(r.newBestRun && r.newUnassistedBest).toBe(true);
    expect(r.newAchievements).toEqual(expect.arrayContaining(['first-exit', 'shortest-path']));
  });

  it('an assisted win completes the world but never sets the unassisted best, optimal, or achievements', () => {
    const r = win(emptySave(), 'w01-first-steps', 2);
    const p = r.save.levels['w01-first-steps']!;
    expect(p.completed).toBe(true);
    expect(p.bestRun).toBe(8);
    expect(p.bestUnassistedRun).toBeNull();
    expect(p.bestActions).toBeNull();
    expect(p.usedHints).toBe(true);
    expect(r.isOptimal).toBe(false);
    expect(r.newAchievements).toEqual([]);
  });

  it('keeps the better of two runs and does not re-award achievements', () => {
    const first = win(emptySave(), 'w01-first-steps');
    const second = win(first.save, 'w01-first-steps');
    expect(second.newBestRun).toBe(false);
    expect(second.newAchievements).toEqual([]);
    expect(second.save.levels['w01-first-steps']!.wins).toBe(2);
  });

  it('older saves stay playable when levels are inserted before worlds they already finished', () => {
    const s = win(emptySave(), 'w05-garden-shifts').save;
    expect(isUnlocked(s, 'w05-garden-shifts')).toBe(true);
    expect(isUnlocked(s, CAMPAIGN_ORDER[CAMPAIGN_ORDER.indexOf('w05-garden-shifts') - 1] as string)).toBe(true);
    expect(isUnlocked(emptySave(), 'w05-garden-shifts')).toBe(false);
  });

  it('aggregate achievements: three unassisted worlds, and every world', () => {
    let s = emptySave();
    const ids = [...CAMPAIGN_ORDER];
    let earned: string[] = [];
    for (const id of ids) {
      const r = win(s, id);
      s = r.save;
      earned = [...earned, ...r.newAchievements];
    }
    expect(earned).toContain('no-help');
    expect(earned).toContain('every-world');
    expect(completedCount(s)).toBe(CAMPAIGN_ORDER.length);
  });

  it('losses count attempts without completing anything', () => {
    const s = recordLoss(emptySave(), 'w01-first-steps');
    expect(s.levels['w01-first-steps']).toMatchObject({ attempts: 1, completed: false, wins: 0 });
  });

  it('settings patch is immutable', () => {
    const a = emptySave();
    const b = withSettings(a, { volume: 0.2, motion: 'reduced' });
    expect(a.settings.volume).toBe(0.7);
    expect(b.settings).toMatchObject({ volume: 0.2, motion: 'reduced' });
  });
});

describe('parsing is tolerant and never trusts the file', () => {
  it('returns an empty save for null, junk, wrong version or non-objects', () => {
    for (const raw of [null, '', 'not json', '[]', '"x"', '{"v":2}', '{"v":1,"levels":5}']) expect(Object.keys(parseSave(raw).levels)).toEqual([]);
  });

  it('drops malformed entries and clamps bad values but keeps good ones', () => {
    const raw = JSON.stringify({
      v: 1,
      levels: { good: { completed: true, attempts: 2, wins: 1, bestRun: 9, bestUnassistedRun: 9, bestActions: [{ type: 'COMMIT' }], firstWonAt: 'x', usedHints: false }, bad: 7, bad2: { bestRun: -3, bestActions: [{ type: 'FLY' }] } },
      achievements: { a: { at: 't', levelId: 'w01' }, b: 3 },
      settings: { sound: 'yes', volume: 9, motion: 'reduced', music: false },
    });
    const s = parseSave(raw);
    expect(s.levels.good).toMatchObject({ completed: true, bestRun: 9 });
    expect(s.levels.bad).toBeUndefined();
    expect(s.levels.bad2).toMatchObject({ bestRun: null, bestActions: null });
    expect(Object.keys(s.achievements)).toEqual(['a']);
    expect(s.settings).toEqual({ sound: true, music: false, volume: 0.7, motion: 'reduced' });
  });

  it('session parsing rejects bad action logs', () => {
    expect(parseSession(JSON.stringify({ v: 1, levelId: 'w01', levelVersion: 2, actions: [{ type: 'MOVE', direction: 'UP' }], hintsUsed: 9 }))?.hintsUsed).toBe(3);
    expect(parseSession(JSON.stringify({ v: 1, levelId: 'w01', levelVersion: 2, actions: [{ type: 'NOPE' }] }))).toBeNull();
    expect(parseSession('garbage')).toBeNull();
  });
});

describe('SaveStore', () => {
  it('persists, reloads, notifies subscribers, and resets', () => {
    const kv = memory();
    const store = new SaveStore(() => kv);
    let calls = 0;
    store.subscribe(() => calls++);
    store.set(win(store.get(), 'w01-first-steps').save);
    expect(calls).toBe(1);
    expect(kv.m.has(SAVE_KEY)).toBe(true);
    expect(new SaveStore(() => kv).get().levels['w01-first-steps']?.completed).toBe(true);
    store.setSession({ v: 1, levelId: 'w02-orange-switch', levelVersion: 2, actions: [], hintsUsed: 0, startedAt: 'x' });
    expect(store.getSession()?.levelId).toBe('w02-orange-switch');
    store.reset();
    expect(store.getSession()).toBeNull();
    expect(completedCount(store.get())).toBe(0);
    expect(kv.m.has(SESSION_KEY)).toBe(false);
  });

  it('survives blocked or throwing storage: plays from memory without throwing', () => {
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(pickStorage(() => throwing).persistent).toBe(false);
    const store = new SaveStore(() => throwing);
    expect(store.persistent).toBe(false);
    expect(() => store.set(win(store.get(), 'w01-first-steps').save)).not.toThrow();
    expect(store.get().levels['w01-first-steps']?.completed).toBe(true);
  });

  it('survives storage that fails only on write (quota)', () => {
    const kv = memory();
    const quota = { ...kv, setItem: (k: string, v: string) => { if (k === SAVE_KEY) throw new Error('quota'); kv.setItem(k, v); } };
    const store = new SaveStore(() => quota);
    expect(() => store.set(win(store.get(), 'w01-first-steps').save)).not.toThrow();
    expect(store.get().levels['w01-first-steps']?.completed).toBe(true);
  });

  it('a corrupted stored save loads as empty instead of crashing', () => {
    const kv = memory();
    kv.setItem(SAVE_KEY, '{oops');
    expect(completedCount(new SaveStore(() => kv).get())).toBe(0);
  });
});
