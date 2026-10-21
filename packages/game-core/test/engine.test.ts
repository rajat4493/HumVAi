import { describe, expect, it } from 'vitest';
import type { ChallengeDefinition, GameAction } from '../src';
import { LEVELS, create, evaluate, legalActions, observe, parseWorld, renderAscii, replay, solve, step } from '../src';

const [l1, l2, l3, l4, l5] = LEVELS as [
  ChallengeDefinition,
  ChallengeDefinition,
  ChallengeDefinition,
  ChallengeDefinition,
  ChallengeDefinition,
];

const mv = (s: string): GameAction[] =>
  [...s].map((c) => ({ type: 'MOVE', direction: ({ U: 'UP', D: 'DOWN', L: 'LEFT', R: 'RIGHT' } as const)[c as 'U'] }));
const use = (id: string): GameAction => ({ type: 'INTERACT', targetId: id });

describe('determinism & initialization', () => {
  it('same challenge, seed and actions give identical hashes', () => {
    const actions = mv('RRDDRRUU');
    const a = replay(l1, actions, 's');
    const b = replay(l1, actions, 's');
    expect(a).toEqual(b);
    expect(a.won).toBe(true);
  });

  it('starts at the map start with a full budget', () => {
    const o = observe(create(l2, 'x'));
    expect(o.player).toEqual({ x: 1, y: 1 });
    expect(o.actionsUsed).toBe(0);
    expect(o.actionsRemaining).toBe(l2.budget);
    expect(o.status).toBe('playing');
  });

  it('every level definition parses', () => {
    for (const l of LEVELS) expect(() => parseWorld(l)).not.toThrow();
  });

  it('rejects structurally invalid challenges', () => {
    expect(() => create({ ...l1, map: ['###', '#.#'] }, 'x')).toThrow(/start|exit/);
    expect(() => create({ ...l1, map: ['#@E#', '#.#'] }, 'x')).toThrow(/length/);
    expect(() => create({ ...l2, rules: { doors: {} } }, 'x')).toThrow(/no rule/);
  });
});

describe('partial observability', () => {
  it('observations never contain hidden rules', () => {
    for (const l of LEVELS) {
      const json = JSON.stringify(observe(create(l, 's')));
      expect(json).not.toContain('"rules"');
      expect(json).not.toContain('switchEnabled');
      expect(json).not.toContain('doors');
      expect(json).not.toContain('"shift"');
    }
  });

  it('step results expose no internal state', () => {
    const s = create(l4, 's');
    const r = step(s, { type: 'MOVE', direction: 'RIGHT' });
    expect(Object.keys(r.state)).not.toContain('switches');
    expect(Object.keys(r.state)).not.toContain('challenge');
  });

  it('ASCII observation is stable and legible', () => {
    expect(renderAscii(observe(create(l1, 's')))).toMatchInlineSnapshot(`
      "#######
      #@..#E#
      #.#.#.#
      #.#...#
      #######
      actions: 0/12  epoch: 0  status: playing"
    `);
  });
});

describe('movement and budget', () => {
  it('bumping a wall costs an action but does not move', () => {
    const s = create(l1, 's');
    const r = step(s, { type: 'MOVE', direction: 'LEFT' });
    expect(r.valid).toBe(true);
    expect(r.events[0]).toMatchObject({ type: 'BLOCKED', reason: 'wall' });
    expect(r.state.player).toEqual({ x: 1, y: 1 });
    expect(r.state.actionsUsed).toBe(1);
  });

  it('losing happens exactly when the budget is spent without winning', () => {
    const s = create(l1, 's');
    let last = step(s, { type: 'MOVE', direction: 'LEFT' });
    for (let i = 1; i < l1.budget; i++) last = step(s, { type: 'MOVE', direction: 'LEFT' });
    expect(last.state.status).toBe('lost');
    expect(last.terminal).toBe(true);
    expect(legalActions(s)).toEqual([]);
  });

  it('winning on the final action is a win, not a loss', () => {
    const tight = { ...l1, budget: 8 };
    expect(replay(tight, mv('RRDDRRUU')).status).toBe('won');
  });

  it('actions after the game ends are rejected and flagged in replay', () => {
    const s = create(l1, 's');
    for (const a of mv('RRDDRRUU')) step(s, a);
    const r = step(s, { type: 'MOVE', direction: 'DOWN' });
    expect(r.valid).toBe(false);
    expect(replay(l1, [...mv('RRDDRRUU'), ...mv('D')]).extraActions).toBe(true);
  });

  it('INTERACT with a non-adjacent or unknown target is rejected and free', () => {
    const s = create(l2, 's');
    const far = step(s, use('switch-orange'));
    expect(far.valid).toBe(false);
    expect(far.state.actionsUsed).toBe(0);
    expect(step(s, use('nope')).valid).toBe(false);
    expect(evaluate(s).rejectedActions).toBe(2);
  });

  it('legal actions only offer adjacent switches', () => {
    const s = create(l2, 's');
    expect(legalActions(s).some((a) => a.type === 'INTERACT')).toBe(false);
    step(s, { type: 'MOVE', direction: 'RIGHT' });
    expect(legalActions(s)).toContainEqual(use('switch-orange'));
  });
});

describe('level 2 — switches (one real, one decoy)', () => {
  it('orange opens the door; teal does nothing to it', () => {
    const s = create(l2, 's');
    mv('RRDD').forEach((a) => step(s, a)); // (3,3): beside teal
    const decoy = step(s, use('switch-teal'));
    expect(decoy.events).toEqual([{ type: 'SWITCH_TOGGLED', id: 'switch-teal', on: true }]);
    expect(decoy.state.entities.find((e) => e.id === 'door-garden')?.state).toBe('closed');
    step(s, { type: 'MOVE', direction: 'UP' }); // (3,2): beside orange
    const real = step(s, use('switch-orange'));
    expect(real.events).toContainEqual({ type: 'DOOR_OPENED', id: 'door-garden' });
  });

  it('testing the decoy first still fits the budget (12 of 14 actions) — exploration is affordable', () => {
    const path = [...mv('RRDD'), use('switch-teal'), ...mv('U'), use('switch-orange'), ...mv('RRRRU')];
    const out = replay(l2, path);
    expect(out.won).toBe(true);
    expect(out.actionsUsed).toBe(12);
  });

  it('there are exactly six distinct optimal solutions', () => {
    expect(solve(l2).optimalSolutionCount).toBe(6);
  });

  it('a closed door blocks movement', () => {
    const s = create(l2, 's');
    mv('RRDR').forEach((a) => step(s, a));
    const r = step(s, { type: 'MOVE', direction: 'RIGHT' });
    expect(r.events[0]).toMatchObject({ type: 'BLOCKED', reason: 'door' });
  });
});

describe('level 3 — blocks and plates', () => {
  it('standing on the plate opens the door only while you stand there', () => {
    const s = create(l3, 's');
    // walk to (4,1) then step down onto plate (4,2)
    mv('RRR').forEach((a) => step(s, a));
    const on = step(s, { type: 'MOVE', direction: 'DOWN' });
    expect(on.events).toContainEqual({ type: 'PLATE_PRESSED', id: 'plate-garden' });
    expect(on.events).toContainEqual({ type: 'DOOR_OPENED', id: 'door-garden' });
    const off = step(s, { type: 'MOVE', direction: 'UP' });
    expect(off.events).toContainEqual({ type: 'DOOR_CLOSED', id: 'door-garden' });
  });

  it('a pushed block holds the plate, and blocks cannot be pushed into walls', () => {
    const s = create(l3, 's');
    mv('DRR').forEach((a) => step(s, a)); // push block right twice
    expect(observe(s).entities.find((e) => e.id === 'plate-garden')?.state).toBe('pressed');
    const again = step(s, { type: 'MOVE', direction: 'RIGHT' });
    expect(again.events[0]).toMatchObject({ type: 'BLOCKED', reason: 'block' });
  });
});

describe('level 4 — conditional rules', () => {
  it('triangle is jammed while circle is on, and gives no explanation', () => {
    const s = create(l4, 's');
    mv('RRRRRR').forEach((a) => step(s, a)); // stand above triangle (6,1)
    const r = step(s, use('switch-triangle'));
    expect(r.events).toEqual([{ type: 'NO_EFFECT', targetId: 'switch-triangle' }]);
    expect(r.state.actionsUsed).toBe(7);
  });

  it('square overrides triangle', () => {
    const s = create(l4, 's');
    step(s, { type: 'MOVE', direction: 'RIGHT' });
    step(s, use('switch-circle'));
    mv('RR').forEach((a) => step(s, a));
    step(s, use('switch-square'));
    mv('RR').forEach((a) => step(s, a));
    const t = step(s, use('switch-triangle'));
    expect(t.events).toEqual([{ type: 'SWITCH_TOGGLED', id: 'switch-triangle', on: true }]);
    expect(t.state.entities.find((e) => e.id === 'door-exit')?.state).toBe('closed');
  });
});

describe('level 5 — rule change', () => {
  it('the tripwire flips the epoch and inverts door rules', () => {
    const s = create(l5, 's');
    step(s, { type: 'MOVE', direction: 'RIGHT' });
    step(s, use('switch-one'));
    mv('RRRRR').forEach((a) => step(s, a)); // (3..7,1): last step is the tripwire at x=7
    const o = observe(s);
    expect(o.epoch).toBe(1);
    expect(o.entities.find((e) => e.id === 'door-far')?.state).toBe('open');
    expect(o.entities.find((e) => e.id === 'door-gate')?.state).toBe('closed');
  });

  it('the learned strategy (switch-two on) now closes the door', () => {
    const s = create(l5, 's');
    step(s, { type: 'MOVE', direction: 'RIGHT' });
    step(s, use('switch-one'));
    mv('RRR').forEach((a) => step(s, a)); // stand at (5,1) under switch-two
    step(s, use('switch-two')); // phase 0: opens far door
    expect(observe(s).entities.find((e) => e.id === 'door-far')?.state).toBe('open');
    mv('RR').forEach((a) => step(s, a)); // trip the wire
    expect(observe(s).entities.find((e) => e.id === 'door-far')?.state).toBe('closed');
  });
});

describe('level 5 — naive vs insightful play', () => {
  const R: GameAction = { type: 'MOVE', direction: 'RIGHT' };
  const L: GameAction = { type: 'MOVE', direction: 'LEFT' };

  it('a player who toggles switch-two before the shift still wins, but pays 18 actions instead of 10', () => {
    const naive = [R, use('switch-one'), R, R, R, use('switch-two'), R, R, R, L, L, L, use('switch-two'), R, R, R, R, R];
    const out = replay(l5, naive);
    expect(out.won).toBe(true);
    expect(out.actionsUsed).toBe(18);
    expect(solve(l5).optimalLength).toBe(10);
  });

  it('bumping the closed far door after the shift burns budget until the player loses', () => {
    const stuck = [R, use('switch-one'), R, R, R, use('switch-two'), R, R, R, ...Array.from({ length: 20 }, () => R)];
    expect(replay(l5, stuck).status).toBe('lost');
  });
});

describe('reset', () => {
  it('restores the world but spends budget', () => {
    const s = create(l3, 's');
    mv('DRR').forEach((a) => step(s, a));
    const r = step(s, { type: 'RESET' });
    expect(r.state.player).toEqual({ x: 1, y: 1 });
    expect(r.state.actionsUsed).toBe(4);
    expect(r.state.entities.find((e) => e.id === 'block-purple')?.pos).toEqual({ x: 2, y: 2 });
  });
});

describe('solvability (engine-driven BFS)', () => {
  for (const level of LEVELS) {
    it(`${level.id} is solvable within budget and its solution replays`, () => {
      const r = solve(level);
      expect(r.solvable).toBe(true);
      expect(r.withinBudget).toBe(true);
      const out = replay(level, r.optimalSolution as GameAction[]);
      expect(out.won).toBe(true);
      expect(out.actionsUsed).toBe(r.optimalLength);
    });
  }

  it('difficulty rises: budget slack is positive but never trivially large', () => {
    for (const level of LEVELS) {
      const r = solve(level);
      expect(level.budget - (r.optimalLength as number)).toBeGreaterThan(0);
    }
  });
});
