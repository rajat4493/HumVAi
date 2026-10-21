export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type GameAction =
  | { type: 'MOVE'; direction: Direction }
  | { type: 'INTERACT'; targetId: string }
  | { type: 'RESET' }
  /** Ends scouting and starts the strict run. Only legal during scouting. */
  | { type: 'COMMIT' };

export type Phase = 'explore' | 'execute';

export interface Pos {
  x: number;
  y: number;
}

/** Boolean condition over the "signals" in the world (switch state, plate pressure). */
export type Cond =
  | { op: 'on'; id: string }
  | { op: 'not'; arg: Cond }
  | { op: 'and'; args: Cond[] }
  | { op: 'or'; args: Cond[] }
  | { op: 'const'; value: boolean };

export type EntityKind = 'door' | 'switch' | 'plate' | 'block' | 'tripwire';

export interface LegendEntry {
  kind: EntityKind;
  id: string;
}

/**
 * The rules the player is NOT told. They live in the challenge definition,
 * are never copied into any observation, and are only discoverable by acting.
 */
export interface HiddenRules {
  /** Door is open iff its condition holds (evaluated after every action). */
  doors: Record<string, Cond>;
  /** INTERACT with a switch is a silent no-op unless its condition holds. */
  switchEnabled?: Record<string, Cond>;
  /** Switches that begin ON (default OFF). */
  switchInitiallyOn?: string[];
  /**
   * Rule change. The first time `tripwire` is triggered the world enters
   * epoch 1 and the listed doors switch to the given conditions
   * (doors not listed keep their epoch-0 condition).
   */
  shift?: { tripwire: string; doors: Record<string, Cond> };
}

export interface ChallengeDefinition {
  id: string;
  version: number;
  name: string;
  /** Shown to the player before play. Must not leak hidden rules. */
  briefing: string;
  learning: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /**
   * Scout & Run budgets, identical for human and AI.
   * explore: actions allowed while scouting (0 = no scouting, the level starts in the run).
   * execute: actions allowed in the run.
   */
  budget: { explore: number; execute: number };
  /** '#' wall, '.' floor, '@' start, 'E' exit, any other char is looked up in `legend`. */
  map: string[];
  legend: Record<string, LegendEntry>;
  rules: HiddenRules;
}

export type PublicEntityState =
  | 'open'
  | 'closed'
  | 'on'
  | 'off'
  | 'pressed'
  | 'idle'
  | 'armed'
  | 'spent'
  | 'static';

export interface PublicEntity {
  id: string;
  kind: EntityKind;
  pos: Pos;
  state: PublicEntityState;
}

export type Status = 'playing' | 'won' | 'lost';

/** Everything a participant (human or AI) is allowed to know. */
export interface PublicGameState {
  challengeId: string;
  version: number;
  width: number;
  height: number;
  /** Rows of '#' (wall) and '.' (floor). Entities are listed separately. */
  tiles: string[];
  player: Pos;
  exit: Pos;
  entities: PublicEntity[];
  /** Current phase: scouting (a sandbox) or the strict run. */
  phase: Phase;
  scout: { budget: number; used: number };
  run: { budget: number; used: number };
  /** Actions left in the *current* phase. */
  actionsRemaining: number;
  /** Visible world epoch; increments when the world visibly changes its behaviour. */
  epoch: number;
  status: Status;
}

export type GameEvent =
  | { type: 'MOVED'; from: Pos; to: Pos }
  | { type: 'BLOCKED'; at: Pos; reason: 'wall' | 'door' | 'switch' | 'block' | 'edge' }
  | { type: 'PUSHED'; id: string; from: Pos; to: Pos }
  | { type: 'PULLED'; id: string; from: Pos; to: Pos }
  | { type: 'SWITCH_TOGGLED'; id: string; on: boolean }
  | { type: 'NO_EFFECT'; targetId: string }
  | { type: 'DOOR_OPENED'; id: string }
  | { type: 'DOOR_CLOSED'; id: string }
  | { type: 'PLATE_PRESSED'; id: string }
  | { type: 'PLATE_RELEASED'; id: string }
  | { type: 'EPOCH_CHANGED'; epoch: number }
  | { type: 'RESET' }
  | { type: 'COMMITTED'; reason: 'player' | 'scout-spent' }
  /** The player stands on the exit while scouting. Nothing is won and nothing starts: the player must COMMIT. */
  | { type: 'EXIT_FOUND' }
  | { type: 'WON' }
  | { type: 'LOST' }
  | { type: 'REJECTED'; reason: string };

export interface StepResult {
  state: PublicGameState;
  events: GameEvent[];
  /** False when the action was malformed/illegal; rejected actions cost no budget. */
  valid: boolean;
  terminal: boolean;
}

export interface GameOutcome {
  status: Status;
  won: boolean;
  /** Actions spent scouting (never affects win/lose). */
  scoutActions: number;
  /** Actions spent in the run (the competitive number). */
  runActions: number;
  rejectedActions: number;
  /** Hash of the final internal state; equal hashes == identical worlds. */
  finalStateHash: string;
  /** Replay only: true if actions were supplied after the game had already ended. */
  extraActions: boolean;
}

/** Internal state. Contains hidden information — never hand this to a participant. */
export interface GameState {
  readonly challenge: ChallengeDefinition;
  readonly seed: string;
  player: Pos;
  blocks: Record<string, Pos>;
  switches: Record<string, boolean>;
  doorsOpen: Record<string, boolean>;
  platesPressed: Record<string, boolean>;
  tripwiresSpent: string[];
  epoch: number;
  phase: Phase;
  scoutUsed: number;
  runUsed: number;
  rejectedActions: number;
  status: Status;
}
