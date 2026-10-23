import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import { SOLUTIONS, expand } from './solutions';
import { fixedPlayer, MACROS, solve } from './solver';
import { H, KEY, W, cloneSim, createSim, parseLevel, replay, step } from './sim';
import type { BeamMode, LevelDef, Sim } from './sim';

const modesOf = (l: LevelDef): BeamMode[] => (l.beams === 'adaptive' ? ['lead', 'camp'] : ['lead']);

describe('the five levels', () => {
  it('are five, in order, each one screen of 20 x 11 with one start and a way to finish', () => {
    expect(LEVELS.map((l) => l.n)).toEqual([1, 2, 3, 4, 5]);
    for (const l of LEVELS) {
      expect(l.rows).toHaveLength(H);
      for (const r of l.rows) expect(r).toHaveLength(W);
      const p = parseLevel(l);
      expect(p.start.x).toBeGreaterThan(0);
      if (l.goal === 'exit') expect(p.exit, l.id).not.toBeNull();
      else expect(p.buttons.some((b) => b.kind === 'R'), l.id).toBe(true);
    }
  });
});

describe('every level can be completed', () => {
  for (const level of LEVELS) {
    for (const mode of modesOf(level)) {
      it(`${level.id} [${mode}]: the recorded winning inputs still win, from a clean start`, () => {
        const sol = SOLUTIONS.find((s) => s.level === level.id && s.mode === mode);
        expect(sol, 'no stored solution: run `npx tsx tools/dpt-solve.ts`').toBeDefined();
        expect(sol!.version, 'the level changed: regenerate solutions with tools/dpt-solve.ts').toBe(level.version);
        const end = replay(level, expand(sol!.runs), mode);
        expect(end.won).toBe(true);
        expect(end.tick / 60).toBeLessThan(12); // a level is seconds long: a retry costs almost nothing
      });
    }
  }

  for (const level of LEVELS.filter((l) => l.n < 5)) {
    for (const mode of modesOf(level)) {
      it(`${level.id} [${mode}]: an independent search finds a way through without being told one`, () => {
        const r = solve(level, mode, { maxNodes: 800_000 });
        expect(r.solved).toBe(true);
      });
    }
  }

  it('level 5: an independent (walking-only) search also finds a way through', { timeout: 120_000 }, () => {
    const r = solve(LEVELS[4]!, 'lead', { walkOnly: true, weight: 1, maxNodes: 3_000_000 });
    expect(r.solved).toBe(true);
  });
});

describe('each level hides one idea, and the winning run shows it', () => {
  const sol = (n: number, mode: BeamMode = 'lead'): Sim => {
    const level = LEVELS[n - 1]!;
    return replay(level, expand(SOLUTIONS.find((s) => s.level === level.id && s.mode === mode)!.runs), mode);
  };
  it('1: the ceiling bar is sprung (by you, early) and the player jumps the spikes it leaves', () => {
    const s = sol(1);
    expect(s.events.some((e) => e.type === 'drop_trigger')).toBe(true);
    expect(s.events.some((e) => e.type === 'drop_land')).toBe(true);
  });
  it('2: a late jump never springs the vents', () => {
    const s = sol(2);
    expect(s.events.some((e) => e.type === 'zone_trigger')).toBe(false);
    expect(s.events.some((e) => e.type === 'takeoff' && e.x >= 8)).toBe(true);
  });
  it('3: both stars are taken, so gravity flips and flips back', () => {
    const s = sol(3);
    expect(s.events.filter((e) => e.type === 'star').map((e) => (e as { gs: number }).gs)).toEqual([-1, 1]);
  });
  it('4: the beam locks and misses, in both modes', () => {
    for (const mode of ['lead', 'camp'] as const) {
      const s = sol(4, mode);
      expect(s.events.some((e) => e.type === 'beam_lock')).toBe(true);
      expect(s.events.some((e) => e.type === 'beam_end' && !e.hit)).toBe(true);
    }
  });
  it('5: the host breaks its own wall, and the player lives to press the button', () => {
    const s = sol(5);
    expect(s.events.some((e) => e.type === 'beam_start' && e.broke > 0)).toBe(true);
    expect(s.events.some((e) => e.type === 'button' && e.id === 'R')).toBe(true);
    expect(s.dead).toBeNull();
  });
});

describe('waiting does not break a level', () => {
  // A player who reads the screen for a while must not be locked out: after any pause at the start (while still alive) a way through exists.
  for (const level of LEVELS.filter((l) => l.n < 5)) {
    for (const mode of modesOf(level)) {
      it(`${level.id} [${mode}]: still winnable after standing still for a while`, () => {
        for (const wait of level.beams === 'off' ? [30, 300] : [20, 60, 100]) {
          const s = createSim(level, mode);
          for (let t = 0; t < wait; t++) step(s, 0);
          expect(s.dead, `${level.id} waited ${wait} ticks`).toBeNull();
          expect(solve(level, mode, { from: s, maxNodes: 800_000 }).solved, `${level.id} waited ${wait}`).toBe(true);
        }
      });
    }
  }
});

describe('the surprises are real: no level is beaten by just running', () => {
  for (const level of LEVELS) {
    it(`${level.id}: holding right (alone, or while hopping) does not win`, () => {
      for (const mode of modesOf(level)) {
        expect(fixedPlayer(level, () => KEY.R, 900, mode).won).toBe(false);
        // (level 1 can be crossed by a hopping rhythm that happens to fly over the falling bar; that is luck, not a way around the trap)
        if (level.n !== 1) expect(fixedPlayer(level, (t) => KEY.R | (t % 40 < 8 ? KEY.J : 0), 900, mode).won).toBe(false);
      }
    });
  }
  it('4: the plan that ignores the beam is caught by the beam that leads', () => {
    const level = LEVELS[3]!;
    const free = solve({ ...level, id: 'l4-free', beams: 'off' });
    expect(free.solved).toBe(true);
    expect(replay(level, free.inputs, 'lead').won).toBe(false); // running steadily is exactly what the leading beam punishes
    expect(replay(level, free.inputs, 'camp').won).toBe(true); // and the other aim punishes the opposite: that is the mind game
  });
});

/**
 * "No unwinnable states": for the levels with no clock in them, explore every state reachable with the player's controls and check
 * that from each one either the exit can still be reached, or the player can die (which respawns). A state where you are alive,
 * cannot finish, and cannot even die would be a soft-lock, and restart is not the answer to a design that allows one.
 */
/** Coarser than the solver's key (0.25-tile cells, direction of travel only), so the whole reachable space fits and can be searched. */
const coarseKey = (s: Sim): string => {
  const p = s.p;
  return [Math.round(p.x * 4), Math.round(p.y * 2), Math.sign(Math.round(p.vx)), Math.sign(Math.round(p.vy)), p.grounded ? 1 : 0, p.gs, s.dead ? 'd' : s.won ? 'w' : 'a', s.starsTaken.join(''), s.buttonsPressed.join(''), s.drops.map((d) => d.phase.charAt(0) + Math.floor(d.ticks / 8)).join(','), s.zones.map((z) => z.phase.charAt(0)).join(','), s.broken.length].join('|');
};

function softLocks(level: LevelDef, cap = 600_000): { states: number; stuck: Sim[]; complete: boolean } {
  const start = createSim(level);
  const index = new Map<string, number>();
  const sims: Sim[] = [];
  const edges: number[][] = [];
  const add = (s: Sim): number => {
    const k = coarseKey(s);
    const have = index.get(k);
    if (have !== undefined) return have;
    index.set(k, sims.length);
    sims.push(s);
    edges.push([]);
    return sims.length - 1;
  };
  add(start);
  const deadSet = new Set<number>();
  const winSet = new Set<number>();
  for (let i = 0; i < sims.length && sims.length < cap; i++) {
    const cur = sims[i]!;
    if (cur.dead) {
      deadSet.add(i);
      continue;
    }
    if (cur.won) {
      winSet.add(i);
      continue;
    }
    for (const m of MACROS) {
      const nx = cloneSim(cur);
      nx.events = [];
      for (const inp of m) {
        step(nx, inp);
        if (nx.dead || nx.won) break;
      }
      const j = add(nx);
      edges[i]!.push(j);
    }
  }
  // reverse reachability: which states can reach a win, and which can reach a death
  const rev: number[][] = sims.map(() => []);
  edges.forEach((es, i) => es.forEach((j) => rev[j]!.push(i)));
  const reach = (seed: Set<number>): Set<number> => {
    const seen = new Set<number>(seed);
    const queue = [...seed];
    while (queue.length) {
      const x = queue.pop()!;
      for (const p of rev[x]!) {
        if (seen.has(p)) continue;
        seen.add(p);
        queue.push(p);
      }
    }
    return seen;
  };
  const canWin = reach(winSet);
  const canDie = reach(deadSet);
  const complete = sims.length < cap;
  const stuck = sims.filter((s, i) => !s.dead && !s.won && edges[i]!.length > 0 && !canWin.has(i) && !canDie.has(i));
  return { states: sims.length, stuck, complete };
}

describe('no soft-locks (levels without a clock)', () => {
  it('the scan itself can fail: with the second star and the hanging spikes removed, a player who flips is stranded on the ceiling', () => {
    const l3 = LEVELS[2]!;
    const broken: LevelDef = { ...l3, id: 'l3-broken', rows: l3.rows.map((r, i) => (i === 2 ? r.replace(/[v*]/g, '.') : r)) };
    const r = softLocks(broken);
    expect(r.stuck.length).toBeGreaterThan(0);
  });

  for (const n of [1, 2, 3]) {
    it(`level ${n}: every reachable state can still win or die`, { timeout: 120_000 }, () => {
      const r = softLocks(LEVELS[n - 1]!);
      expect(r.states).toBeGreaterThan(100);
      expect(r.complete, `explored ${r.states} states`).toBe(true);
      expect(r.stuck.map((s) => `${s.p.x.toFixed(1)},${s.p.y.toFixed(1)}`)).toEqual([]);
    });
  }
});
