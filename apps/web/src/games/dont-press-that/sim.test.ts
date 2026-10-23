import { describe, expect, it } from 'vitest';
import { LEVELS, levelByN } from './levels';
import { BEAM, BUFFER, COYOTE, HH, HW, JUMP_V, KEY, RESPAWN_TICKS, RUN, W, createSim, parseLevel, replay, solidAt, stateKey, step } from './sim';
import type { LevelDef, Sim } from './sim';

const L = (n: number): LevelDef => levelByN(n)!;
const open = (rows: string[], extra: Partial<LevelDef> = {}): LevelDef => ({
  id: 'test',
  n: 99,
  name: 'test',
  version: 1,
  rows,
  drops: [],
  zones: [],
  marks: [],
  beams: 'off',
  button: 'none',
  goal: 'exit',
  ...extra,
});
const floorRows = (rows: Record<number, string>): string[] => Array.from({ length: 11 }, (_, i) => rows[i] ?? '.'.repeat(20));
const FLAT = floorRows({ 8: '.P..................', 9: '#'.repeat(20), 10: '#'.repeat(20) });

const run = (s: Sim, input: number, ticks: number): void => {
  for (let i = 0; i < ticks; i++) step(s, input);
};

describe('movement feel', () => {
  it('reaches the run speed and stops almost at once', () => {
    const s = createSim(open(FLAT));
    run(s, KEY.R, 20);
    expect(s.p.vx).toBeCloseTo(RUN, 5);
    run(s, 0, 8);
    expect(s.p.vx).toBe(0);
  });

  it('a held jump rises about 3 tiles; a tap is a short hop', () => {
    const held = createSim(open(FLAT));
    const startY = held.p.y;
    let top = startY;
    for (let i = 0; i < 60; i++) {
      step(held, KEY.J);
      top = Math.min(top, held.p.y);
    }
    expect(startY - top).toBeGreaterThan(2.9);
    expect(startY - top).toBeLessThan(3.2);
    const tap = createSim(open(FLAT));
    let topTap = tap.p.y;
    for (let i = 0; i < 60; i++) {
      step(tap, i < 2 ? KEY.J : 0);
      topTap = Math.min(topTap, tap.p.y);
    }
    expect(startY - topTap).toBeGreaterThan(0.6);
    expect(startY - topTap).toBeLessThan(1.9);
    expect(JUMP_V).toBeGreaterThan(0);
  });

  it('a running jump covers 4 to 5 tiles on the flat', () => {
    const s = createSim(open(FLAT));
    run(s, KEY.R, 15);
    const x0 = s.p.x;
    step(s, KEY.R | KEY.J);
    let n = 0;
    while (!s.p.grounded && n++ < 90) step(s, KEY.R | KEY.J);
    expect(s.p.x - x0).toBeGreaterThan(4.2);
    expect(s.p.x - x0).toBeLessThan(5.2);
  });

  it('coyote time: a jump pressed just after leaving a ledge still works, a late one does not', () => {
    const rows = floorRows({ 8: '.P..................', 9: '##########..........', 10: '##########..........' });
    const jumpAfterEdge = (delay: number): boolean => {
      const s = createSim(open(rows));
      while (s.p.grounded || s.p.x < 9.9) step(s, KEY.R);
      for (let i = 0; i < delay; i++) step(s, KEY.R);
      const y = s.p.y;
      step(s, KEY.R | KEY.J);
      step(s, KEY.R | KEY.J);
      return s.p.vy < 0 && s.p.y < y + 0.1;
    };
    expect(jumpAfterEdge(COYOTE - 3)).toBe(true);
    expect(jumpAfterEdge(COYOTE + 4)).toBe(false);
  });

  it('jump buffer: a press a few ticks before landing jumps on landing', () => {
    const s = createSim(open(FLAT));
    run(s, KEY.J, 10); // rising
    while (s.p.y < s.parsed.start.y - 0.3) step(s, 0);
    step(s, KEY.J); // pressed while still in the air, close to the floor
    let jumped = false;
    for (let i = 0; i < BUFFER + 6 && !jumped; i++) {
      step(s, KEY.J);
      if (s.events.filter((e) => e.type === 'takeoff').length >= 2) jumped = true;
    }
    expect(jumped).toBe(true);
  });
});

describe('collisions', () => {
  it('walls stop a runner without letting the body into them', () => {
    const s = createSim(open(FLAT));
    run(s, KEY.R, 400);
    expect(s.p.x).toBeLessThanOrEqual(W - HW + 1e-6);
    expect(solidAt(s, Math.floor(s.p.x + HW - 1e-3), Math.floor(s.p.y))).toBe(false);
  });

  it('never ends a tick inside a solid tile, in any level, under pseudo-random play (including flipped gravity)', () => {
    let seed = 7;
    const rnd = (): number => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (const level of LEVELS) {
      for (let rep = 0; rep < 12; rep++) {
        const s = createSim(level, rep % 2 ? 'camp' : 'lead');
        let held = 0;
        for (let t = 0; t < 900 && !s.dead && !s.won; t++) {
          if (t % 7 === 0) held = (rnd() < 0.5 ? KEY.R : rnd() < 0.5 ? KEY.L : 0) | (rnd() < 0.4 ? KEY.J : 0);
          step(s, held);
          const x0 = Math.floor(s.p.x - HW + 1e-4), x1 = Math.floor(s.p.x + HW - 1e-4), y0 = Math.floor(s.p.y - HH + 1e-4), y1 = Math.floor(s.p.y + HH - 1e-4);
          for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) expect(solidAt(s, tx, ty), `${level.id} tick ${t}`).toBe(false);
        }
      }
    }
  });

  it('spike hitboxes are forgiving: standing beside a spike is safe, stepping on it is not', () => {
    const rows = floorRows({ 8: '.P....^.............', 9: '#'.repeat(20), 10: '#'.repeat(20) });
    const s = createSim(open(rows));
    // stop with the body's right edge a little short of the spike's tile
    while (s.p.x < 5.45) step(s, KEY.R);
    run(s, 0, 20);
    expect(s.dead).toBeNull();
    const t = createSim(open(rows));
    run(t, KEY.R, 60);
    expect(t.dead?.cause).toBe('spike');
  });
});

describe('determinism', () => {
  it('the same inputs give the same events and the same state, every time', () => {
    for (const level of LEVELS) {
      const inputs = Array.from({ length: 500 }, (_, i) => (i % 11 < 6 ? KEY.R : 0) | (i % 23 < 4 ? KEY.J : 0));
      const a = replay(level, inputs, 'camp');
      const b = replay(level, inputs, 'camp');
      expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
      expect(stateKey(a, false)).toBe(stateKey(b, false));
    }
  });
});

describe('level 1: the falling bar', () => {
  it('shakes first, then falls, then stays as spikes you can jump', () => {
    const s = createSim(L(1));
    while (s.p.x < 10.05) step(s, KEY.R);
    expect(s.events.some((e) => e.type === 'drop_trigger' && e.by === 'walk')).toBe(true);
    const trig = s.events.find((e) => e.type === 'drop_trigger')!.t;
    run(s, 0, 8);
    expect(s.drops[0]!.phase).toBe('tell');
    run(s, 0, 40);
    expect(s.drops[0]!.phase).toBe('landed');
    const land = s.events.find((e) => e.type === 'drop_land')!.t;
    expect(land - trig).toBeGreaterThanOrEqual(14);
    expect(s.dead).toBeNull(); // it fell in front of a player who stopped
  });
  it('the red button, up on its ledge, springs the trap from far away, harmlessly', () => {
    const s = createSim(L(1));
    s.p.x = 4.5; // standing on the ledge, as a player who jumped up would be
    s.p.y = 6 - HH;
    s.p.grounded = true;
    run(s, 0, 3);
    expect(s.events.some((e) => e.type === 'button' && e.id === 'B')).toBe(true);
    expect(s.events.some((e) => e.type === 'drop_trigger' && e.by === 'button')).toBe(true);
    run(s, 0, 60);
    expect(s.drops[0]!.phase).toBe('landed');
    expect(s.dead).toBeNull();
  });
  it('walking under the ledge does not press the button, and the trap still waits for you', () => {
    const s = createSim(L(1));
    while (s.p.x < 9.5) step(s, KEY.R);
    expect(s.events.some((e) => e.type === 'button')).toBe(false);
    expect(s.drops[0]!.phase).toBe('armed');
  });
});

describe('level 2: the vents', () => {
  it('spring only for a takeoff before x = 8, and a late jump is safe', () => {
    const early = createSim(L(2));
    while (early.p.x < 6) step(early, KEY.R);
    run(early, KEY.R | KEY.J, 40);
    expect(early.events.some((e) => e.type === 'zone_trigger')).toBe(true);
    expect(early.dead?.cause).toBe('zone');
    const late = createSim(L(2));
    while (late.p.x < 8.6) step(late, KEY.R);
    run(late, KEY.R | KEY.J, 80);
    expect(late.events.some((e) => e.type === 'zone_trigger')).toBe(false);
    expect(late.dead).toBeNull();
  });
});

describe('level 3: stars', () => {
  it('flip gravity, and jump goes the other way', () => {
    const s = createSim(L(3));
    while (s.p.x < 4.6) step(s, KEY.R);
    run(s, 0, 40);
    expect(s.p.gs).toBe(-1);
    expect(s.p.grounded).toBe(true);
    expect(s.p.y).toBeLessThan(4); // on the ceiling
    const y0 = s.p.y;
    run(s, KEY.J, 8);
    expect(s.p.y).toBeGreaterThan(y0 + 0.5); // "up" is now toward the floor
    expect(parseLevel(L(3)).stars).toHaveLength(2);
  });
});

describe('the beam (levels 4 and 5)', () => {
  const lockAfterGrace = (mode: 'lead' | 'camp', input: number): { aim: number; x: number } => {
    const s = createSim(open(FLAT, { beams: 'adaptive' }), mode);
    for (let i = 0; i < 400 && !s.events.some((e) => e.type === 'beam_lock'); i++) step(s, input);
    const lk = s.events.find((e) => e.type === 'beam_lock') as Extract<Sim['events'][number], { type: 'beam_lock' }>;
    return { aim: lk.aim, x: s.p.x };
  };

  it('has a quiet start, then tracks, locks, fires and rests, in that order and on a fixed clock', () => {
    const s = createSim(L(4), 'lead');
    const marks: Record<string, number> = {};
    for (let i = 0; i < 400 && !marks.end; i++) {
      step(s, 0);
      for (const e of s.events) if (e.type.startsWith('beam') && !(e.type in marks)) marks[e.type] = e.t;
      if (s.dead) break;
    }
    expect(marks.beam_track).toBe(BEAM.grace + 1);
    expect(marks.beam_lock! - marks.beam_track!).toBe(BEAM.track);
    expect(marks.beam_start! - marks.beam_lock!).toBe(BEAM.lock);
  });

  it('lead mode aims where you will be if you keep going; camp mode aims where you stand', () => {
    const lead = lockAfterGrace('lead', KEY.R);
    expect(lead.aim).toBeGreaterThan(lead.x + 1.5); // ahead of a runner
    const camp = lockAfterGrace('camp', KEY.R);
    expect(Math.abs(camp.aim - camp.x)).toBeLessThan(0.05);
    const still = lockAfterGrace('lead', 0);
    expect(Math.abs(still.aim - still.x)).toBeLessThan(0.05); // someone who is standing is aimed at where they are
  });

  it('the locked marker does not move: you can always dodge what you can see', () => {
    const s = createSim(L(4), 'lead');
    let locked: number | null = null;
    let sawLock = false;
    for (let i = 0; i < 400 && !s.dead; i++) {
      step(s, i % 40 < 20 ? KEY.R : KEY.L);
      if (s.beam.phase === 'lock') {
        sawLock = true;
        locked ??= s.beam.aim;
        expect(s.beam.aim).toBe(locked);
      } else locked = null;
    }
    expect(sawLock).toBe(true);
  });

  it('a beam breaks cracked walls it overlaps and nothing else; broken tiles stop being solid', () => {
    const s = createSim(L(5), 'lead');
    expect(solidAt(s, 18, 6)).toBe(true);
    s.beam.phase = 'lock';
    s.beam.left = 1;
    s.beam.aim = 18.5;
    s.p.x = 3;
    step(s, 0);
    expect(s.events.some((e) => e.type === 'beam_start' && e.broke === 5)).toBe(true);
    expect(solidAt(s, 18, 6)).toBe(false);
    expect(solidAt(s, 10, 3)).toBe(true); // other blocks are untouched
  });

  it('kills a player standing in the column and reports the hit', () => {
    const s = createSim(L(4), 'camp');
    run(s, 0, BEAM.grace + BEAM.track + BEAM.lock + 4);
    expect(s.dead?.cause).toBe('beam');
    expect(s.events.some((e) => e.type === 'beam_end' && e.hit)).toBe(true);
  });
});

describe('respawn', () => {
  it('control always comes back within a quarter of a second, and sooner on a key press', () => {
    expect(RESPAWN_TICKS / 60).toBeLessThanOrEqual(0.25);
  });
});
