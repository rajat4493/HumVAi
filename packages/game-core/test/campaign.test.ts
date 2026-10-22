import { describe, expect, it } from 'vitest';
import type { GameAction } from '../src';
import { ALL_ACHIEVEMENTS, CAMPAIGN, CAMPAIGN_ORDER, LEVELS, analyzeRun, campaignEntry, earnedFromRun, levelById, nextLevelId, solve } from '../src';

const mv = (s: string): GameAction[] =>
  [...s].map((c) => ({ type: 'MOVE', direction: ({ U: 'UP', D: 'DOWN', L: 'LEFT', R: 'RIGHT' } as const)[c as 'U'] }));
const use = (id: string): GameAction => ({ type: 'INTERACT', targetId: id });
const COMMIT: GameAction = { type: 'COMMIT' };
const ctx = (id: string, actions: GameAction[], hints = 0) => {
  const level = levelById(id)!;
  return { levelId: id, analysis: analyzeRun(level, actions), optimalLength: solve(level).optimalLength as number, hintsUsed: hints };
};

describe('campaign table', () => {
  it('lists every level exactly once, and only levels that exist', () => {
    expect(new Set(CAMPAIGN_ORDER).size).toBe(CAMPAIGN_ORDER.length);
    expect([...CAMPAIGN_ORDER].sort()).toEqual(LEVELS.map((l) => l.id).sort());
    for (const id of CAMPAIGN_ORDER) expect(levelById(id)).toBeDefined();
  });

  it('every level has three distinct hints, the last of which is a complete route or instruction', () => {
    for (const c of CAMPAIGN) for (const l of c.levels) {
      expect(new Set(l.hints).size).toBe(3);
      for (const h of l.hints) expect(h.length).toBeGreaterThan(10);
    }
  });

  it('keeps the planned chapter identities and navigation helpers', () => {
    expect(CAMPAIGN.map((c) => c.name)).toEqual(['Awakening', 'The Unknown', 'The Strategist', 'Adaptation', 'The Frontier']);
    expect(campaignEntry('w05-garden-shifts')?.chapter.id).toBe('ch4');
    expect(nextLevelId('w01-first-steps')).toBe('w02-orange-switch');
    expect(nextLevelId('w02-orange-switch')).toBe('w06-both-needed');
    expect(nextLevelId(CAMPAIGN_ORDER[CAMPAIGN_ORDER.length - 1] as string)).toBeNull();
  });

  it('is the planned 5 x 4 campaign, and the Level 10 review set keeps its order', () => {
    expect(CAMPAIGN.map((c) => c.levels.length)).toEqual([4, 4, 4, 4, 4]);
    expect(CAMPAIGN_ORDER).toHaveLength(20);
    expect(CAMPAIGN_ORDER.slice(0, 10)).toEqual([
      'w01-first-steps', 'w02-orange-switch', 'w06-both-needed', 'w07-off-is-on', 'w03-locked-garden',
      'w04-only-when', 'w11-corner-piece', 'w09-hold-the-line', 'w10-in-order', 'w08-heavy-load',
    ]);
  });

  it('timing worlds: Two Springs must start with the slower-fading left switch', () => {
    const first = (solve(levelById('w18-two-springs')!).optimalSolution as GameAction[]).find((a) => a.type === 'INTERACT');
    expect(first).toEqual({ type: 'INTERACT', targetId: 'switch-left' });
  });

  it('the route hint for World 1 really is a winning route', () => {
    const l = levelById('w01-first-steps')!;
    expect(analyzeRun(l, mv('RRDDRRUU')).outcome.won).toBe(true);
  });
});

describe('run analysis and verified achievements', () => {
  it('records events with their phase, and counts scout vs run resets', () => {
    const l = levelById('w03-locked-garden')!;
    const a = analyzeRun(l, [...mv('DRR'), { type: 'RESET' }, COMMIT, ...mv('DRR'), { type: 'RESET' }]);
    expect(a.scoutResets).toBe(1);
    expect(a.runResets).toBe(1);
    expect(a.events.some((e) => e.phase === 'explore' && e.event.type === 'PUSHED')).toBe(true);
    expect(a.events.some((e) => e.phase === 'execute' && e.event.type === 'PUSHED')).toBe(true);
  });

  it('awards run achievements only from a verified win, and none when hints were used', () => {
    const w1 = ctx('w01-first-steps', mv('RRDDRRUU'));
    expect(earnedFromRun(w1)).toEqual(['first-exit', 'shortest-path']);
    expect(earnedFromRun({ ...w1, hintsUsed: 1 })).toEqual([]);
    const lost = ctx('w01-first-steps', mv('LLLLLLLLLLLL'));
    expect(earnedFromRun(lost)).toEqual([]);
  });

  it('Decoy Detective needs the decoy toggled during Scout and a win', () => {
    const scoutThenRun: GameAction[] = [...mv('RRDD'), use('switch-teal'), COMMIT, ...mv('RRD'), use('switch-orange'), ...mv('RRURR')];
    expect(earnedFromRun(ctx('w02-orange-switch', scoutThenRun))).toEqual(expect.arrayContaining(['decoy-detective', 'scouts-honor', 'shortest-path']));
    const noScout: GameAction[] = [COMMIT, ...mv('RRD'), use('switch-orange'), ...mv('RRURR')];
    expect(earnedFromRun(ctx('w02-orange-switch', noScout))).not.toContain('decoy-detective');
  });

  it('Hands On needs a drag; Tide Turner needs the change seen in Scout; Failure Is Information needs a jam in Scout', () => {
    const drag: GameAction[] = [...mv('DRR'), use('block-purple'), COMMIT, ...(solve(levelById('w03-locked-garden')!).optimalSolution as GameAction[])];
    expect(earnedFromRun(ctx('w03-locked-garden', drag))).toContain('hands-on');
    const jam: GameAction[] = [...mv('RRRRR'), use('switch-triangle'), COMMIT, ...(solve(levelById('w04-only-when')!).optimalSolution as GameAction[])];
    expect(earnedFromRun(ctx('w04-only-when', jam))).toContain('failure-is-information');
    const tide: GameAction[] = [...mv('R'), use('switch-one'), ...mv('RRRDR'), COMMIT, ...(solve(levelById('w05-garden-shifts')!).optimalSolution as GameAction[])];
    expect(earnedFromRun(ctx('w05-garden-shifts', tide))).toContain('tide-turner');
  });

  it('has unique achievement ids with teasers that do not reveal solutions', () => {
    expect(new Set(ALL_ACHIEVEMENTS.map((a) => a.id)).size).toBe(ALL_ACHIEVEMENTS.length);
    for (const a of ALL_ACHIEVEMENTS) expect(a.teaser.toLowerCase()).not.toMatch(/orange|teal|triangle|rune|plate/);
  });
});
