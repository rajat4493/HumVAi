import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import { Session, STILL_LIMIT, chooseMode } from './session';
import type { AttemptSummary } from './session';
import { KEY, RESPAWN_MIN, RESPAWN_TICKS, createSim, replay, step } from './sim';

const L1 = LEVELS[0]!;
const L4 = LEVELS[3]!;

const dieBy = (s: Session): void => {
  // walk into the falling bar of level 1
  for (let i = 0; i < 300 && !s.sim.dead; i++) s.step(KEY.R);
};

describe('respawn', () => {
  it('returns control within a quarter of a second of dying, with no input at all', () => {
    const s = new Session(L1);
    dieBy(s);
    expect(s.sim.dead).not.toBeNull();
    let ticks = 0;
    while (s.sim.dead && ticks < 100) {
      s.step(0);
      ticks++;
    }
    expect(s.attempt).toBe(2);
    expect(ticks).toBeLessThanOrEqual(RESPAWN_TICKS);
    expect(s.history[0]!.respawnTicks).toBeLessThanOrEqual(RESPAWN_TICKS);
    expect(RESPAWN_TICKS * (1000 / 60)).toBeLessThan(500); // the brief: under 500 ms
  });

  it('a fresh key press skips the rest, after a moment so a held key cannot skip it by accident', () => {
    const s = new Session(L1);
    dieBy(s);
    s.step(0);
    s.step(KEY.J); // too soon: still showing the break
    expect(s.sim.dead).not.toBeNull();
    for (let i = 0; i < RESPAWN_MIN; i++) s.step(0);
    const before = s.attempt;
    s.step(KEY.R);
    expect(s.attempt).toBe(before + 1);
  });

  it('a held key does not skip: only a new press does', () => {
    const s = new Session(L1);
    dieBy(s); // still holding right
    let n = 0;
    while (s.sim.dead && n++ < 100) s.step(KEY.R);
    expect(n).toBeGreaterThanOrEqual(RESPAWN_TICKS - 1);
  });

  it('the world is the same every time: respawn is a clean start, and traps are armed again', () => {
    const s = new Session(L1);
    const first = JSON.stringify(createSim(L1).p);
    dieBy(s);
    while (s.sim.dead) s.step(0);
    expect(JSON.stringify(s.sim.p)).toBe(first);
    expect(s.sim.drops.every((d) => d.phase === 'armed')).toBe(true);
  });
});

describe('restart', () => {
  it('R restarts at once and is recorded as a restart, not a death', () => {
    const s = new Session(L1);
    for (let i = 0; i < 20; i++) s.step(KEY.R);
    const out = s.step(KEY.R | KEY.RESTART);
    expect(out.ended?.outcome).toBe('restart');
    expect(out.respawned).toBe(true);
    expect(s.sim.tick).toBe(0);
    expect(s.history.filter((a) => a.outcome === 'death')).toHaveLength(0);
  });
});

describe('what was recorded', () => {
  it('run-length inputs expand to exactly what was pressed', () => {
    const s = new Session(L1);
    const pressed: number[] = [];
    for (let i = 0; i < 300 && !s.sim.dead; i++) {
      const k = (i < 30 ? KEY.R : i < 40 ? 0 : KEY.R) & 7;
      pressed.push(k);
      s.step(k);
    }
    while (s.sim.dead) s.step(0);
    const a = s.history[0]!;
    const expanded = a.inputs.flatMap((r) => Array.from({ length: r >> 4 }, () => r & 15));
    expect(expanded.slice(0, pressed.length)).toEqual(pressed);
    // and replaying them reproduces the same death
    const re = replay(L1, expanded);
    expect(re.dead?.cause).toBe(a.cause);
    expect(re.dead?.x).toBeCloseTo(a.deathX!, 6);
  });

  it('measures time to retry: from regaining control to the first key', () => {
    const s = new Session(L1);
    dieBy(s);
    while (s.sim.dead) s.step(0);
    for (let i = 0; i < 25; i++) s.step(0);
    s.step(KEY.R);
    expect(s.history[0]!.retryTicks).toBe(25);
  });
});

describe('level 4 remembers how you played', () => {
  const mk = (stillMax: number, ticks = 200): AttemptSummary => ({ n: 1, outcome: 'death', ticks, cause: 'beam', deathX: 3, deathY: 8, stillMax, mode: 'lead', events: [], inputs: [], retryTicks: null, respawnTicks: 10 });
  it('aims ahead of a runner, and at the feet of someone who waits', () => {
    expect(chooseMode([])).toBe('lead');
    expect(chooseMode([mk(5)])).toBe('lead');
    expect(chooseMode([mk(STILL_LIMIT)])).toBe('camp');
    expect(chooseMode([mk(STILL_LIMIT + 50)])).toBe('camp');
  });
  it('ignores an attempt too short to say anything, and uses the latest real one', () => {
    expect(chooseMode([mk(50, 200), mk(60, 20)])).toBe('camp');
    expect(chooseMode([mk(50, 200), mk(2, 300)])).toBe('lead');
  });
  it('is applied at the start of the next attempt', () => {
    const s = new Session(L4);
    expect(s.mode).toBe('lead');
    for (let i = 0; i < 90; i++) s.step(i < 5 ? KEY.R : 0); // move a little, then wait it out
    for (let i = 0; i < 300 && !s.sim.dead && !s.sim.won; i++) s.step(0);
    while (s.sim.dead) s.step(0);
    expect(s.history[0]!.stillMax).toBeGreaterThanOrEqual(STILL_LIMIT);
    expect(s.mode).toBe('camp');
    expect(s.sim.mode).toBe('camp');
  });
});

describe('the simulation underneath is untouched by being wrapped', () => {
  it('the same inputs give the same world with or without a Session', () => {
    const inputs = Array.from({ length: 200 }, (_, i) => (i % 9 < 5 ? KEY.R : 0) | (i % 17 < 3 ? KEY.J : 0));
    const bare = createSim(L1);
    const wrapped = new Session(L1);
    for (const i of inputs) {
      if (!bare.dead && !bare.won) step(bare, i);
      if (!wrapped.sim.dead) wrapped.step(i);
      else break;
    }
    expect(wrapped.sim.dead?.cause).toBe(bare.dead?.cause);
  });
});
