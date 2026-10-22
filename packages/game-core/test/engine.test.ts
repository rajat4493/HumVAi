import { describe, expect, it } from 'vitest';
import type { ChallengeDefinition, GameAction, GameEvent } from '../src';
import { LEVELS, create, evaluate, legalActions, observe, parseWorld, renderAscii, replay, solve, step, worldKey } from '../src';

const [l1, l2, l3, l4, l5] = LEVELS as [
  ChallengeDefinition,
  ChallengeDefinition,
  ChallengeDefinition,
  ChallengeDefinition,
  ChallengeDefinition,
];

/** The same level with scouting switched off, so mechanics can be tested inside the strict run. */
const run = (l: ChallengeDefinition): ChallengeDefinition => ({ ...l, budget: { explore: 0, execute: l.budget.execute } });

const mv = (s: string): GameAction[] =>
  [...s].map((c) => ({ type: 'MOVE', direction: ({ U: 'UP', D: 'DOWN', L: 'LEFT', R: 'RIGHT' } as const)[c as 'U'] }));
const use = (id: string): GameAction => ({ type: 'INTERACT', targetId: id });
const COMMIT: GameAction = { type: 'COMMIT' };
const RESET: GameAction = { type: 'RESET' };
const play = (l: ChallengeDefinition, actions: GameAction[]) => {
  const s = create(l, 's');
  const events: GameEvent[] = [];
  for (const a of actions) events.push(...step(s, a).events);
  return { s, events, obs: observe(s) };
};
const doorState = (o: ReturnType<typeof observe>, id: string) => o.entities.find((e) => e.id === id)?.state;

describe('determinism & initialization', () => {
  it('same challenge, seed and actions give identical outcomes and hashes', () => {
    const a = replay(l1, mv('RRDDRRUU'), 's');
    expect(a).toEqual(replay(l1, mv('RRDDRRUU'), 's'));
    expect(a.won).toBe(true);
  });

  it('starts at the map start with full budgets; scouting levels start in the scout phase', () => {
    const o = observe(create(l2, 'x'));
    expect(o.player).toEqual({ x: 1, y: 1 });
    expect(o.phase).toBe('explore');
    expect(o.scout).toEqual({ budget: 16, used: 0 });
    expect(o.run).toEqual({ budget: 12, used: 0 });
    expect(o.actionsRemaining).toBe(16);
    expect(observe(create(l1, 'x')).phase).toBe('execute');
  });

  it('every level definition parses', () => {
    for (const l of LEVELS) expect(() => parseWorld(l)).not.toThrow();
  });

  it('rejects structurally invalid challenges', () => {
    expect(() => create({ ...l1, map: ['###', '#.#'] }, 'x')).toThrow(/start|exit/);
    expect(() => create({ ...l1, map: ['#@E#', '#.#'] }, 'x')).toThrow(/length/);
    expect(() => create({ ...l2, rules: { doors: {} } }, 'x')).toThrow(/no rule/);
    expect(() => create({ ...l1, budget: { explore: 0, execute: 0 } }, 'x')).toThrow(/execute budget/);
    expect(() => create({ ...l5, rules: { ...l5.rules, shift: { tripwire: 'switch-one', doors: {} } } }, 'x')).toThrow(/non-tripwire/);
  });
});

describe('partial observability', () => {
  it('observations never contain hidden rules', () => {
    for (const l of LEVELS) {
      const json = JSON.stringify(observe(create(l, 's')));
      for (const key of ['"rules"', 'switchEnabled', '"doors"', '"shift"', '"const"']) expect(json).not.toContain(key);
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
      phase: execute  scout: 0/0  run: 0/12  epoch: 0  status: playing"
    `);
  });
});

describe('movement and run budget', () => {
  it('bumping a wall costs an action but does not move', () => {
    const s = create(l1, 's');
    const r = step(s, { type: 'MOVE', direction: 'LEFT' });
    expect(r.valid).toBe(true);
    expect(r.events[0]).toMatchObject({ type: 'BLOCKED', reason: 'wall' });
    expect(r.state.player).toEqual({ x: 1, y: 1 });
    expect(r.state.run.used).toBe(1);
  });

  it('losing happens exactly when the run budget is spent without winning', () => {
    const s = create(l1, 's');
    let last = step(s, { type: 'MOVE', direction: 'LEFT' });
    for (let i = 1; i < l1.budget.execute; i++) last = step(s, { type: 'MOVE', direction: 'LEFT' });
    expect(last.state.status).toBe('lost');
    expect(last.terminal).toBe(true);
    expect(legalActions(s)).toEqual([]);
  });

  it('winning on the final action is a win, not a loss', () => {
    expect(replay({ ...l1, budget: { explore: 0, execute: 8 } }, mv('RRDDRRUU')).status).toBe('won');
  });

  it('actions after the game ends are rejected and flagged in replay', () => {
    const s = create(l1, 's');
    for (const a of mv('RRDDRRUU')) step(s, a);
    expect(step(s, { type: 'MOVE', direction: 'DOWN' }).valid).toBe(false);
    expect(replay(l1, [...mv('RRDDRRUU'), ...mv('D')]).extraActions).toBe(true);
  });

  it('INTERACT with a non-adjacent or unknown target is rejected and free', () => {
    const s = create(l2, 's');
    const far = step(s, use('switch-orange'));
    expect(far.valid).toBe(false);
    expect(far.state.scout.used).toBe(0);
    expect(step(s, use('nope')).valid).toBe(false);
    expect(evaluate(s).rejectedActions).toBe(2);
  });

  it('legal actions only offer adjacent interactables', () => {
    const s = create(l2, 's');
    expect(legalActions(s).some((a) => a.type === 'INTERACT')).toBe(false);
    step(s, { type: 'MOVE', direction: 'RIGHT' });
    expect(legalActions(s)).toContainEqual(use('switch-orange'));
  });
});

describe('Scout & Run budget model', () => {
  it('scouting actions spend only the scout budget; the run starts untouched', () => {
    const { obs } = play(l2, [...mv('RR')]);
    expect(obs.scout.used).toBe(2);
    expect(obs.run.used).toBe(0);
    expect(obs.actionsRemaining).toBe(14);
  });

  it('RESET is free while scouting and costs one action in the run', () => {
    const scouting = play(l2, [...mv('RR'), RESET]);
    expect(scouting.obs.player).toEqual({ x: 1, y: 1 });
    expect(scouting.obs.scout.used).toBe(2);
    const running = play(run(l2), [...mv('RR'), RESET]);
    expect(running.obs.player).toEqual({ x: 1, y: 1 });
    expect(running.obs.run.used).toBe(3);
  });

  it('COMMIT restores the world, keeps the scouting tally, and starts a full run budget', () => {
    const { obs, events } = play(l2, [...mv('RRD'), use('switch-orange'), COMMIT]);
    expect(events.at(-1)).toEqual({ type: 'COMMITTED', reason: 'player' });
    expect(obs.phase).toBe('execute');
    expect(obs.scout.used).toBe(4);
    expect(obs.run.used).toBe(0);
    expect(obs.player).toEqual({ x: 1, y: 1 });
    expect(doorState(obs, 'door-garden')).toBe('closed'); // the world forgot; the participant must remember
  });

  it('COMMIT costs nothing and is illegal in the run', () => {
    const s = create(l2, 's');
    step(s, COMMIT);
    const r = step(s, COMMIT);
    expect(r.valid).toBe(false);
    expect(legalActions(s)).not.toContainEqual(COMMIT);
  });

  it('scouting can never win, and reaching the exit does NOT start the run: the player must commit', () => {
    const l = { ...l1, budget: { explore: 12, execute: 12 } };
    const { obs, events, s } = play(l, mv('RRDDRRUU'));
    expect(events.some((e) => e.type === 'WON')).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'EXIT_FOUND' });
    expect(events.some((e) => e.type === 'COMMITTED')).toBe(false);
    expect(obs.status).toBe('playing');
    expect(obs.phase).toBe('explore');
    expect(obs.player).toEqual(obs.exit);
    expect(obs.scout.used).toBe(8);
    // the player can keep experimenting from the exit, then commits explicitly
    const stepped = step(s, { type: 'MOVE', direction: 'DOWN' });
    expect(stepped.events.some((e) => e.type === 'EXIT_FOUND')).toBe(false);
    const committed = step(s, COMMIT);
    expect(committed.events).toEqual([{ type: 'COMMITTED', reason: 'player' }]);
    expect(committed.state.phase).toBe('execute');
    expect(committed.state.player).toEqual({ x: 1, y: 1 });
  });

  it('reaching the exit with the last scouting action still ends scouting (budget spent)', () => {
    const l = { ...l1, budget: { explore: 8, execute: 12 } };
    const { obs, events } = play(l, mv('RRDDRRUU'));
    expect(events.at(-1)).toEqual({ type: 'COMMITTED', reason: 'scout-spent' });
    expect(events.some((e) => e.type === 'EXIT_FOUND')).toBe(false);
    expect(obs.phase).toBe('execute');
  });

  it('spending the whole scouting budget starts the run automatically', () => {
    const { obs, events } = play(l2, Array.from({ length: 16 }, () => mv('L')[0] as GameAction));
    expect(events.at(-1)).toEqual({ type: 'COMMITTED', reason: 'scout-spent' });
    expect(obs.phase).toBe('execute');
    expect(obs.scout.used).toBe(16);
  });

  it('scout-then-run is replayable and reports both numbers', () => {
    const scout = [...mv('RRDD'), use('switch-teal'), ...mv('U'), use('switch-orange'), COMMIT];
    const runPlan = [...mv('RRD'), use('switch-orange'), ...mv('RRURR')];
    const out = replay(l2, [...scout, ...runPlan]);
    expect(out).toMatchObject({ won: true, scoutActions: 7, runActions: 9, extraActions: false });
  });

  it('every level can be scouted with a real mistake and still be won inside both budgets', () => {
    const plans: [ChallengeDefinition, GameAction[]][] = [
      [l2, [...mv('RRDD'), use('switch-teal'), ...mv('U'), use('switch-orange'), COMMIT]],
      [l3, [...mv('RRRD'), ...mv('U'), ...mv('D'), RESET, ...mv('DRR'), use('block-purple'), COMMIT]],
      [l4, [...mv('RRRRR'), use('switch-triangle'), ...mv('LLLL'), use('switch-circle'), COMMIT]],
      [l5, [...mv('R'), use('switch-one'), ...mv('RRRDRR'), use('switch-two'), ...mv('URRR'), COMMIT]],
    ];
    for (const [l, scout] of plans) {
      const optimal = solve(l).optimalSolution as GameAction[];
      const out = replay(l, [...scout, ...optimal]);
      expect(out.won, l.id).toBe(true);
      expect(out.scoutActions, l.id).toBeLessThanOrEqual(l.budget.explore);
      expect(out.runActions, l.id).toBe(optimal.length);
    }
  });

  it('budgets get stricter and scouting shrinks (relative to the optimum) as levels advance', () => {
    const ratios = LEVELS.map((l) => l.budget.execute / (solve(l).optimalLength as number));
    expect(ratios[0]).toBeGreaterThan(ratios[4] as number);
    for (const l of LEVELS) expect(l.budget.execute).toBeGreaterThan(solve(l).optimalLength as number);
    expect(l1.budget.explore).toBe(0); // nothing hidden, nothing to scout
    for (const l of [l2, l3, l4, l5]) expect(l.budget.explore).toBeGreaterThanOrEqual(l.budget.execute);
  });
});

describe('level 2 — switches (one real, one decoy)', () => {
  it('orange opens the door; teal does nothing to it', () => {
    const s = create(run(l2), 's');
    mv('RRDD').forEach((a) => step(s, a)); // (3,3): beside teal
    const decoy = step(s, use('switch-teal'));
    expect(decoy.events).toEqual([{ type: 'SWITCH_TOGGLED', id: 'switch-teal', on: true }]);
    expect(doorState(decoy.state, 'door-garden')).toBe('closed');
    step(s, { type: 'MOVE', direction: 'UP' }); // (3,2): beside orange
    expect(step(s, use('switch-orange')).events).toContainEqual({ type: 'DOOR_OPENED', id: 'door-garden' });
  });

  it('testing the decoy first still fits the run budget — one honest experiment is affordable even without scouting', () => {
    const path = [...mv('RRDD'), use('switch-teal'), ...mv('U'), use('switch-orange'), ...mv('RRRRU')];
    const out = replay(run(l2), path);
    expect(out.won).toBe(true);
    expect(out.runActions).toBe(12);
  });

  it('there are exactly six distinct optimal solutions', () => {
    expect(solve(l2).optimalSolutionCount).toBe(6);
  });

  it('a closed door blocks movement', () => {
    const s = create(run(l2), 's');
    mv('RRDR').forEach((a) => step(s, a));
    expect(step(s, { type: 'MOVE', direction: 'RIGHT' }).events[0]).toMatchObject({ type: 'BLOCKED', reason: 'door' });
  });
});

describe('level 3 — blocks and plates (revised: pushable and draggable)', () => {
  const R3 = run(l3);

  it('standing on the plate opens the door only while you stand there', () => {
    const s = create(R3, 's');
    mv('RRR').forEach((a) => step(s, a));
    const on = step(s, { type: 'MOVE', direction: 'DOWN' });
    expect(on.events).toContainEqual({ type: 'PLATE_PRESSED', id: 'plate-garden' });
    expect(on.events).toContainEqual({ type: 'DOOR_OPENED', id: 'door-garden' });
    expect(step(s, { type: 'MOVE', direction: 'UP' }).events).toContainEqual({ type: 'DOOR_CLOSED', id: 'door-garden' });
  });

  it('a pushed block holds the plate, and blocks cannot be pushed into walls', () => {
    const s = create(R3, 's');
    mv('DRR').forEach((a) => step(s, a));
    expect(observe(s).entities.find((e) => e.id === 'plate-garden')?.state).toBe('pressed');
    expect(step(s, { type: 'MOVE', direction: 'RIGHT' }).events[0]).toMatchObject({ type: 'BLOCKED', reason: 'block' });
  });

  it('Interact drags an adjacent block: the player steps back and the block follows', () => {
    const s = create(R3, 's');
    mv('DRR').forEach((a) => step(s, a)); // block on the plate at (4,2), player (3,2)
    const r = step(s, use('block-purple'));
    expect(r.events).toEqual([
      { type: 'PULLED', id: 'block-purple', from: { x: 4, y: 2 }, to: { x: 3, y: 2 } },
      { type: 'MOVED', from: { x: 3, y: 2 }, to: { x: 2, y: 2 } },
      { type: 'PLATE_RELEASED', id: 'plate-garden' },
      { type: 'DOOR_CLOSED', id: 'door-garden' },
    ]);
    expect(r.state.player).toEqual({ x: 2, y: 2 });
  });

  it('a drag with no room behind the player has no effect, but still costs an action', () => {
    const s = create(R3, 's');
    step(s, { type: 'MOVE', direction: 'DOWN' }); // (1,2), block to the right at (2,2); behind the player is the wall (0,2)
    const r = step(s, use('block-purple'));
    expect(r.events).toEqual([{ type: 'NO_EFFECT', targetId: 'block-purple' }]);
    expect(r.state.run.used).toBe(2);
  });

  it('a block pushed against the wall can be dragged back out: no dead ends', () => {
    const s = create(R3, 's');
    [...mv('DDR'), ...mv('U')].forEach((a) => step(s, a)); // from below, push the block up against the top wall
    expect(observe(s).entities.find((e) => e.id === 'block-purple')?.pos).toEqual({ x: 2, y: 1 });
    step(s, use('block-purple')); // drag it back down
    expect(observe(s).entities.find((e) => e.id === 'block-purple')?.pos).toEqual({ x: 2, y: 2 });
    expect(observe(s).player).toEqual({ x: 2, y: 3 });
  });

  it('is fully recoverable: 0 dead states and 0 irreversible states (was 137 dead of 178 before the revision)', () => {
    const r = solve(l3);
    expect(r.deadStates).toBe(0);
    expect(r.irreversibleStates).toBe(0);
    expect(r.reachableStates).toBeGreaterThan(150);
    expect(r.optimalLength).toBe(10);
    expect(r.deadWithinBudget).toBe(0);
  });

  it('the revision did not make the block optional: without it the door cannot be passed', () => {
    const noBlock = { ...l3, map: l3.map.map((row) => row.replace('B', '.')) };
    expect(solve(noBlock).solvable).toBe(false);
  });
});

describe('level 4 — conditional rules', () => {
  it('triangle is jammed while circle is on, and gives no explanation', () => {
    const s = create(run(l4), 's');
    mv('RRRRRR').forEach((a) => step(s, a));
    const r = step(s, use('switch-triangle'));
    expect(r.events).toEqual([{ type: 'NO_EFFECT', targetId: 'switch-triangle' }]);
    expect(r.state.run.used).toBe(7);
  });

  it('square overrides triangle', () => {
    const s = create(run(l4), 's');
    step(s, { type: 'MOVE', direction: 'RIGHT' });
    step(s, use('switch-circle'));
    mv('RR').forEach((a) => step(s, a));
    step(s, use('switch-square'));
    mv('RR').forEach((a) => step(s, a));
    const t = step(s, use('switch-triangle'));
    expect(t.events).toEqual([{ type: 'SWITCH_TOGGLED', id: 'switch-triangle', on: true }]);
    expect(doorState(t.state, 'door-exit')).toBe('closed');
  });
});

describe('level 5 — the rule change is essential', () => {
  const R5 = run(l5);

  it('the rune flips the epoch and rewires the far door to switch-two', () => {
    const { obs, events } = play(R5, [...mv('R'), use('switch-one'), ...mv('RRRDR')]);
    expect(events).toContainEqual({ type: 'EPOCH_CHANGED', epoch: 1 });
    expect(obs.epoch).toBe(1);
    expect(doorState(obs, 'door-far')).toBe('closed'); // switch-two is still off
    const after = play(R5, [...mv('R'), use('switch-one'), ...mv('RRRDR'), use('switch-two')]);
    expect(doorState(after.obs, 'door-far')).toBe('open');
  });

  it('before the rune, switch-two is a dud: it toggles but the far door stays sealed', () => {
    const { obs, events } = play(R5, [...mv('R'), use('switch-one'), ...mv('RRRRD'), use('switch-two')]);
    expect(events.at(-1)).toEqual({ type: 'SWITCH_TOGGLED', id: 'switch-two', on: true });
    expect(doorState(obs, 'door-far')).toBe('closed');
  });

  it('PROOF: no action sequence that never triggers the rule change can win', () => {
    expect(solve(l5).solvable).toBe(true);
    const ignoring = solve(l5, { stayInEpoch0: true });
    expect(ignoring.solvable).toBe(false);
    expect(ignoring.optimalLength).toBeNull();
    expect(ignoring.reachableStates).toBeGreaterThan(20); // it genuinely explored, rather than failing vacuously
  });

  it('every winning line passes through the epoch change before the win', () => {
    const optimal = solve(l5).optimalSolution as GameAction[];
    const { events } = play(R5, optimal);
    const shiftAt = events.findIndex((e) => e.type === 'EPOCH_CHANGED');
    const winAt = events.findIndex((e) => e.type === 'WON');
    expect(shiftAt).toBeGreaterThan(-1);
    expect(shiftAt).toBeLessThan(winAt);
  });

  it('the "phase-0 strategy" (open the gate, toggle switch-two beside the far door, walk through) fails and eventually loses', () => {
    const ignoring = [...mv('R'), use('switch-one'), ...mv('RRRRD'), use('switch-two'), ...Array.from({ length: 20 }, () => mv('R')[0] as GameAction)];
    const out = replay(R5, ignoring);
    expect(out.won).toBe(false);
    expect(out.status).toBe('lost');
  });

  it('toggling switch-two before the rune is not wasted, but the planned order is shorter (13 vs 11 actions)', () => {
    const early = [...mv('R'), use('switch-one'), ...mv('RRRRD'), use('switch-two'), ...mv('L'), ...mv('RURR')];
    expect(early).toHaveLength(13);
    expect(replay(R5, early)).toMatchObject({ won: true, runActions: 13 });
    expect(solve(l5).optimalLength).toBe(11);
  });
});

describe('reset', () => {
  it('restores the world; in the run it spends budget', () => {
    const s = create(run(l3), 's');
    mv('DRR').forEach((a) => step(s, a));
    const r = step(s, RESET);
    expect(r.state.player).toEqual({ x: 1, y: 1 });
    expect(r.state.run.used).toBe(4);
    expect(r.state.entities.find((e) => e.id === 'block-purple')?.pos).toEqual({ x: 2, y: 2 });
  });
});

describe('solvability and shape of every level (engine-driven BFS)', () => {
  for (const level of LEVELS) {
    it(`${level.id} is solvable within the run budget, its solution replays, and nothing is a dead end`, () => {
      const r = solve(level);
      expect(r.solvable).toBe(true);
      expect(r.withinBudget).toBe(true);
      expect(r.deadStates).toBe(0);
      const out = replay(level, [...(level.budget.explore > 0 ? [COMMIT] : []), ...(r.optimalSolution as GameAction[])]);
      expect(out.won).toBe(true);
      expect(out.runActions).toBe(r.optimalLength);
    });
  }
});

describe('rule change can also (un)jam switches', () => {
  // The switch is jammed until the rune is stepped on.
  const jammed: ChallengeDefinition = {
    id: 'test-unjam', version: 1, name: 'x', briefing: 'x', learning: 'x', difficulty: 1,
    budget: { explore: 0, execute: 20 },
    map: ['#######', '#@a...E', '#.w####', '#######'],
    legend: { a: { kind: 'switch', id: 'sw' }, w: { kind: 'tripwire', id: 'rune' } },
    rules: { doors: {}, switchEnabled: { sw: { op: 'const', value: false } }, shift: { tripwire: 'rune', doors: {}, switchEnabled: { sw: { op: 'const', value: true } } } },
  };
  it('the switch does nothing before the change and works after it', () => {
    const s = create(jammed, 's');
    expect(step(s, use('sw')).events).toEqual([{ type: 'NO_EFFECT', targetId: 'sw' }]);
    mv('DR').forEach((a) => step(s, a)); // onto the rune
    expect(observe(s).epoch).toBe(1);
    mv('LU').forEach((a) => step(s, a));
    expect(step(s, use('sw')).events).toEqual([{ type: 'SWITCH_TOGGLED', id: 'sw', on: true }]);
  });

  it('validates references', () => {
    expect(() => create({ ...jammed, rules: { ...jammed.rules, shift: { tripwire: 'rune', doors: {}, switchEnabled: { rune: { op: 'const', value: true } } } } }, 'x')).toThrow(/non-switch/);
  });
});

describe('spring switches (switchTimers)', () => {
  const spring = (n: number): ChallengeDefinition => ({
    id: 'spring-test',
    version: 1,
    name: 'Spring',
    briefing: 'x',
    learning: 'x',
    difficulty: 1,
    budget: { explore: 0, execute: 30 },
    map: ['###########', '#@......DE#', '###a#######'],
    legend: { a: { kind: 'switch', id: 'switch-a' }, D: { kind: 'door', id: 'door-d' } },
    rules: { doors: { 'door-d': { op: 'on', id: 'switch-a' } }, switchTimers: { 'switch-a': n } },
  });
  const R: GameAction = { type: 'MOVE', direction: 'RIGHT' };
  const use: GameAction = { type: 'INTERACT', targetId: 'switch-a' };

  it('pops back off exactly n actions after the toggling action, closing the door', () => {
    const s = create(spring(3), 't');
    step(s, R);
    step(s, R);
    const toggled = step(s, use);
    expect(toggled.events).toContainEqual({ type: 'SWITCH_TOGGLED', id: 'switch-a', on: true });
    const e1 = step(s, { type: 'MOVE', direction: 'LEFT' });
    const e2 = step(s, R);
    expect(e1.events.some((e) => e.type === 'SWITCH_TOGGLED')).toBe(false);
    expect(e2.events.some((e) => e.type === 'SWITCH_TOGGLED')).toBe(false);
    const e3 = step(s, R);
    expect(e3.events).toContainEqual({ type: 'SWITCH_TOGGLED', id: 'switch-a', on: false });
    expect(e3.events).toContainEqual({ type: 'DOOR_CLOSED', id: 'door-d' });
  });

  it('switching it off by hand cancels the timer; switching on again restarts it', () => {
    const s = create(spring(2), 't');
    step(s, R);
    step(s, R);
    step(s, use);
    step(s, use); // off by hand
    const again = step(s, use);
    expect(again.events).toContainEqual({ type: 'SWITCH_TOGGLED', id: 'switch-a', on: true });
    step(s, { type: 'MOVE', direction: 'LEFT' });
    expect(step(s, R).events).toContainEqual({ type: 'SWITCH_TOGGLED', id: 'switch-a', on: false });
  });

  it('the solver and replay agree with the timer (a dash that is too long fails, a short one wins)', () => {
    const tight = spring(5);
    const ok = solve(tight);
    expect(ok.solvable).toBe(true);
    const tooShort = solve(spring(3));
    expect(tooShort.solvable).toBe(false);
  });

  it('worlds without springs keep their original state keys', () => {
    expect(worldKey(create(l1, 'k'))).not.toContain('|sp');
  });
});
