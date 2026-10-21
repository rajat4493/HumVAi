import type {
  ChallengeDefinition,
  Cond,
  Direction,
  GameAction,
  GameEvent,
  GameOutcome,
  GameState,
  Pos,
  PublicEntity,
  PublicGameState,
  StepResult,
} from './types';
import { parseWorld } from './world';

const DELTA: Record<Direction, Pos> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const DIRECTIONS = Object.keys(DELTA) as Direction[];

const eq = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const add = (a: Pos, d: Pos): Pos => ({ x: a.x + d.x, y: a.y + d.y });
const adjacent = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

/** FNV-1a over a canonical string. Not cryptographic; used for determinism checks and solver dedupe. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Canonical key of everything that can change the future (excludes the action counter). */
export function worldKey(s: GameState): string {
  const blocks = Object.keys(s.blocks)
    .sort()
    .map((id) => `${id}@${s.blocks[id]?.x},${s.blocks[id]?.y}`)
    .join(';');
  const sw = Object.keys(s.switches)
    .sort()
    .map((id) => `${id}=${s.switches[id] ? 1 : 0}`)
    .join(';');
  return `p${s.player.x},${s.player.y}|${blocks}|${sw}|e${s.epoch}|t${[...s.tripwiresSpent].sort().join(',')}|${s.status}`;
}

export function stateHash(s: GameState): string {
  return hashString(`${s.challenge.id}:${s.challenge.version}:${s.seed}:${worldKey(s)}:${s.actionsUsed}:${s.rejectedActions}`);
}

function clone(s: GameState): GameState {
  return {
    ...s,
    player: { ...s.player },
    blocks: Object.fromEntries(Object.entries(s.blocks).map(([k, v]) => [k, { ...v }])),
    switches: { ...s.switches },
    doorsOpen: { ...s.doorsOpen },
    platesPressed: { ...s.platesPressed },
    tripwiresSpent: [...s.tripwiresSpent],
  };
}

function signal(s: GameState, id: string): boolean {
  return s.switches[id] ?? s.platesPressed[id] ?? false;
}

function evalCond(s: GameState, c: Cond): boolean {
  switch (c.op) {
    case 'on':
      return signal(s, c.id);
    case 'not':
      return !evalCond(s, c.arg);
    case 'and':
      return c.args.every((a) => evalCond(s, a));
    case 'or':
      return c.args.some((a) => evalCond(s, a));
  }
}

/** Recomputes plates and doors from positions/switches; returns the events for anything that flipped. */
function settle(s: GameState): GameEvent[] {
  const world = parseWorld(s.challenge);
  const events: GameEvent[] = [];

  for (const e of world.entities) {
    if (e.kind !== 'plate') continue;
    const occupied = eq(s.player, e.pos) || Object.values(s.blocks).some((b) => eq(b, e.pos));
    if (occupied !== (s.platesPressed[e.id] ?? false)) {
      events.push({ type: occupied ? 'PLATE_PRESSED' : 'PLATE_RELEASED', id: e.id });
    }
    s.platesPressed[e.id] = occupied;
  }

  for (const e of world.entities) {
    if (e.kind !== 'door') continue;
    const base = evalCond(s, s.challenge.rules.doors[e.id] as Cond);
    const open = s.epoch % 2 === 1 ? !base : base;
    if (open !== (s.doorsOpen[e.id] ?? false)) {
      events.push({ type: open ? 'DOOR_OPENED' : 'DOOR_CLOSED', id: e.id });
    }
    s.doorsOpen[e.id] = open;
  }
  return events;
}

/** Fires tripwires under the player or a block (once each). */
function checkTripwires(s: GameState): GameEvent[] {
  const shift = s.challenge.rules.shift;
  if (!shift || s.tripwiresSpent.includes(shift.tripwire)) return [];
  const wire = parseWorld(s.challenge).entities.find((e) => e.id === shift.tripwire);
  if (!wire) return [];
  const occupied = eq(s.player, wire.pos) || Object.values(s.blocks).some((b) => eq(b, wire.pos));
  if (!occupied) return [];
  s.tripwiresSpent.push(shift.tripwire);
  s.epoch += 1;
  return [{ type: 'EPOCH_CHANGED', epoch: s.epoch }];
}

function initialState(challenge: ChallengeDefinition, seed: string): GameState {
  const world = parseWorld(challenge);
  const s: GameState = {
    challenge,
    seed,
    player: { ...world.start },
    blocks: {},
    switches: {},
    doorsOpen: {},
    platesPressed: {},
    tripwiresSpent: [],
    epoch: 0,
    actionsUsed: 0,
    rejectedActions: 0,
    status: 'playing',
  };
  for (const e of world.entities) {
    if (e.kind === 'block') s.blocks[e.id] = { ...e.pos };
    if (e.kind === 'switch') s.switches[e.id] = (challenge.rules.switchInitiallyOn ?? []).includes(e.id);
  }
  settle(s);
  return s;
}

/** What a mover bumps into at `p`, or null if the tile is enterable by the player. */
function playerObstacle(s: GameState, p: Pos): 'edge' | 'wall' | 'door' | 'switch' | null {
  const world = parseWorld(s.challenge);
  if (p.x < 0 || p.y < 0 || p.x >= world.width || p.y >= world.height) return 'edge';
  if (world.walls[p.y]?.[p.x]) return 'wall';
  for (const e of world.entities) {
    if (!eq(e.pos, p)) continue;
    if (e.kind === 'door' && !s.doorsOpen[e.id]) return 'door';
    if (e.kind === 'switch') return 'switch';
  }
  return null;
}

/** Blocks may only slide onto plain floor, plates and tripwires, and never onto the exit. */
function blockCanEnter(s: GameState, p: Pos, selfId: string): boolean {
  const world = parseWorld(s.challenge);
  if (p.x < 0 || p.y < 0 || p.x >= world.width || p.y >= world.height) return false;
  if (world.walls[p.y]?.[p.x]) return false;
  if (eq(p, world.exit) || eq(p, s.player)) return false;
  for (const [id, b] of Object.entries(s.blocks)) if (id !== selfId && eq(b, p)) return false;
  for (const e of world.entities) {
    if (eq(e.pos, p) && (e.kind === 'door' || e.kind === 'switch')) return false;
  }
  return true;
}

function reject(s: GameState, reason: string): { next: GameState; result: Omit<StepResult, 'state'> } {
  const next = clone(s);
  next.rejectedActions += 1;
  return { next, result: { events: [{ type: 'REJECTED', reason }], valid: false, terminal: s.status !== 'playing' } };
}

export function legalActions(s: GameState): GameAction[] {
  if (s.status !== 'playing') return [];
  const world = parseWorld(s.challenge);
  const out: GameAction[] = DIRECTIONS.map((direction) => ({ type: 'MOVE', direction }));
  for (const e of world.entities) {
    if (e.kind === 'switch' && adjacent(s.player, e.pos)) out.push({ type: 'INTERACT', targetId: e.id });
  }
  out.push({ type: 'RESET' });
  return out;
}

/** Pure transition. Returns the new internal state alongside the participant-safe result. */
export function stepInternal(s: GameState, action: GameAction): { next: GameState; result: StepResult } {
  const wrap = (next: GameState, events: GameEvent[], valid: boolean): { next: GameState; result: StepResult } => ({
    next,
    result: { state: observe(next), events, valid, terminal: next.status !== 'playing' },
  });

  if (s.status !== 'playing') {
    const r = reject(s, 'game already over');
    return wrap(r.next, r.result.events, false);
  }

  const world = parseWorld(s.challenge);
  const next = clone(s);
  const events: GameEvent[] = [];

  switch (action.type) {
    case 'MOVE': {
      const d = DELTA[action.direction as Direction] as Pos | undefined;
      if (!d) {
        const r = reject(s, 'unknown direction');
        return wrap(r.next, r.result.events, false);
      }
      next.actionsUsed += 1;
      const target = add(next.player, d);
      const bumped = playerObstacle(next, target);
      const blockEntry = Object.entries(next.blocks).find(([, b]) => eq(b, target));

      if (bumped) {
        events.push({ type: 'BLOCKED', at: target, reason: bumped });
      } else if (blockEntry) {
        const [id, from] = blockEntry;
        const dest = add(from, d);
        if (blockCanEnter(next, dest, id)) {
          next.blocks[id] = dest;
          const prev = next.player;
          next.player = target;
          events.push({ type: 'PUSHED', id, from, to: dest }, { type: 'MOVED', from: prev, to: target });
        } else {
          events.push({ type: 'BLOCKED', at: target, reason: 'block' });
        }
      } else {
        const prev = next.player;
        next.player = target;
        events.push({ type: 'MOVED', from: prev, to: target });
      }
      break;
    }

    case 'INTERACT': {
      const sw = world.entities.find((e) => e.kind === 'switch' && e.id === action.targetId);
      if (!sw || !adjacent(next.player, sw.pos)) {
        const r = reject(s, 'no interactable target adjacent');
        return wrap(r.next, r.result.events, false);
      }
      next.actionsUsed += 1;
      const gate = next.challenge.rules.switchEnabled?.[sw.id];
      if (gate && !evalCond(next, gate)) {
        events.push({ type: 'NO_EFFECT', targetId: sw.id });
      } else {
        const on = !next.switches[sw.id];
        next.switches[sw.id] = on;
        events.push({ type: 'SWITCH_TOGGLED', id: sw.id, on });
      }
      break;
    }

    case 'RESET': {
      // Restores the world, NOT the budget: resetting is a costed action.
      const fresh = initialState(s.challenge, s.seed);
      fresh.actionsUsed = s.actionsUsed + 1;
      fresh.rejectedActions = s.rejectedActions;
      events.push({ type: 'RESET' });
      return finish(fresh, events, wrap);
    }

    default: {
      const r = reject(s, 'unknown action');
      return wrap(r.next, r.result.events, false);
    }
  }

  events.push(...checkTripwires(next), ...settle(next));
  return finish(next, events, wrap);
}

function finish(
  next: GameState,
  events: GameEvent[],
  wrap: (n: GameState, e: GameEvent[], v: boolean) => { next: GameState; result: StepResult },
) {
  const world = parseWorld(next.challenge);
  if (eq(next.player, world.exit)) {
    next.status = 'won';
    events.push({ type: 'WON' });
  } else if (next.actionsUsed >= next.challenge.budget) {
    next.status = 'lost';
    events.push({ type: 'LOST' });
  }
  return wrap(next, events, true);
}

export function observe(s: GameState): PublicGameState {
  const world = parseWorld(s.challenge);
  const entities: PublicEntity[] = world.entities.map((e): PublicEntity => {
    switch (e.kind) {
      case 'door':
        return { id: e.id, kind: e.kind, pos: e.pos, state: s.doorsOpen[e.id] ? 'open' : 'closed' };
      case 'switch':
        return { id: e.id, kind: e.kind, pos: e.pos, state: s.switches[e.id] ? 'on' : 'off' };
      case 'plate':
        return { id: e.id, kind: e.kind, pos: e.pos, state: s.platesPressed[e.id] ? 'pressed' : 'idle' };
      case 'block':
        return { id: e.id, kind: e.kind, pos: { ...(s.blocks[e.id] as Pos) }, state: 'static' };
      case 'tripwire':
        return { id: e.id, kind: e.kind, pos: e.pos, state: s.tripwiresSpent.includes(e.id) ? 'spent' : 'armed' };
    }
  });
  return {
    challengeId: s.challenge.id,
    version: s.challenge.version,
    width: world.width,
    height: world.height,
    tiles: world.walls.map((row) => row.map((w) => (w ? '#' : '.')).join('')),
    player: { ...s.player },
    exit: { ...world.exit },
    entities,
    budget: s.challenge.budget,
    actionsUsed: s.actionsUsed,
    actionsRemaining: Math.max(0, s.challenge.budget - s.actionsUsed),
    epoch: s.epoch,
    status: s.status,
  };
}

export function evaluate(s: GameState): GameOutcome {
  return {
    status: s.status,
    won: s.status === 'won',
    actionsUsed: s.actionsUsed,
    rejectedActions: s.rejectedActions,
    finalStateHash: stateHash(s),
    extraActions: false,
  };
}

export function create(challenge: ChallengeDefinition, seed: string): GameState {
  return initialState(challenge, seed);
}

/** Advances `s` in place and returns the participant-safe result. Use stepInternal for pure transitions. */
export function step(s: GameState, action: GameAction): StepResult {
  const { next, result } = stepInternal(s, action);
  Object.assign(s, next);
  return result;
}

/** Re-executes an action log from scratch. This is the only thing a verifier should trust. */
export function replay(challenge: ChallengeDefinition, actions: GameAction[], seed = 'replay'): GameOutcome {
  let state = create(challenge, seed);
  let extra = false;
  for (const a of actions) {
    if (state.status !== 'playing') {
      extra = true;
      break;
    }
    state = stepInternal(state, a).next;
  }
  return { ...evaluate(state), extraActions: extra };
}
