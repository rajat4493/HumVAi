import type Phaser from 'phaser';
import type { ChallengeDefinition, Direction, GameAction, GameEvent, GameState, PublicGameState, StepResult } from '@hva/game-core';
import { create, legalActions, observe, step } from '@hva/game-core';
import type { GameScene } from './GameScene';
import { createBoard } from './host';

const KEYS: Record<string, Direction> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  w: 'UP',
  s: 'DOWN',
  a: 'LEFT',
  d: 'RIGHT',
  W: 'UP',
  S: 'DOWN',
  A: 'LEFT',
  D: 'RIGHT',
};

const DELTA: Record<Direction, { x: number; y: number }> = { UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }, LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 } };

/** What the scene needs from whoever drives it: live play (GameController) or a recorded replay. */
export interface BoardController {
  readonly avatar: 'human' | 'ai';
  observe(): PublicGameState;
  attach(scene: GameScene): void;
  dispatch(action: GameAction): StepResult | null;
  interact(): void;
  /** Optional: a tap at board coordinates (in tiles, fractional). Interacts with the nearest adjacent switch or block. */
  interactNear?(x: number, y: number): void;
}

export interface Snapshot {
  obs: PublicGameState;
  events: GameEvent[];
  /** The action that just ran (null for the initial snapshot). */
  action: GameAction | null;
  actions: GameAction[];
}

/** Owns the engine state; Phaser only presents it. React and the scene both send actions here. */
export class GameController implements BoardController {
  readonly avatar = 'human' as const;
  private state: GameState;
  private scene: GameScene | null = null;
  private game: Phaser.Game;
  private listeners = new Set<(s: Snapshot) => void>();
  readonly log: GameAction[] = [];
  /** The way the player last tried to move; Interact prefers the target in that direction. */
  private facing: Direction | null = null;

  constructor(
    parent: HTMLElement,
    private readonly challenge: ChallengeDefinition,
    /** A run in progress to restore silently (engine replay), e.g. after a refresh. */
    initialActions: GameAction[] = [],
  ) {
    this.state = create(challenge, 'human-session');
    for (const a of initialActions) {
      if (this.state.status !== 'playing') break;
      if (step(this.state, a).valid) this.log.push(a);
    }
    this.game = createBoard(parent, this);
    window.addEventListener('keydown', this.onKey);
    (window as unknown as { __HVA__: unknown }).__HVA__ = { getState: () => observe(this.state), log: this.log, tileCenter: (x: number, y: number) => this.scene?.tileCenterClient(x, y) ?? null };
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return; // holding a key must not burn budget
    if (document.querySelector('[aria-modal="true"]')) return; // dialogs own the keyboard
    const t = e.target;
    if (t instanceof HTMLElement && (t.closest('button, input, select, textarea, [role="switch"], [role="radio"]') !== null) && (e.key === ' ' || e.key === 'Enter')) return; // let focused controls activate natively
    const dir = KEYS[e.key];
    if (dir && e.shiftKey) {
      // Shift + direction: interact with the switch or block on that side, at no extra cost
      e.preventDefault();
      this.interactToward(dir);
    } else if (dir) {
      e.preventDefault();
      this.dispatch({ type: 'MOVE', direction: dir });
    } else if (e.key === ' ' || e.key === 'e') {
      // Space/E interact; Enter is left to focused buttons.
      e.preventDefault();
      this.interact();
    } else if (e.key === 'r') {
      this.dispatch({ type: 'RESET' });
    } else if (e.key === 'c') {
      this.dispatch({ type: 'COMMIT' });
    }
  };

  attach(scene: GameScene): void {
    this.scene = scene;
  }
  observe(): PublicGameState {
    return observe(this.state);
  }
  subscribe(fn: (s: Snapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot([], null));
    return () => this.listeners.delete(fn);
  }
  private snapshot(events: GameEvent[], action: GameAction | null): Snapshot {
    return { obs: observe(this.state), events, action, actions: legalActions(this.state) };
  }

  dispatch(action: GameAction): StepResult | null {
    if (this.state.status !== 'playing') return null;
    if (action.type === 'MOVE') this.facing = action.direction;
    const result = step(this.state, action);
    if (result.valid) this.log.push(action);
    this.scene?.present(result.events, result.state);
    this.listeners.forEach((l) => l(this.snapshot(result.events, action)));
    return result;
  }

  /**
   * Interacts with the adjacent switch or block the player is facing (the last way they pressed a direction);
   * with nothing in that direction, the first adjacent one. Standing between two switches therefore works:
   * face one and press Interact, face the other and press Interact.
   */
  interact(): void {
    const options = legalActions(this.state).filter((a): a is Extract<GameAction, { type: 'INTERACT' }> => a.type === 'INTERACT');
    if (options.length === 0) return;
    const obs = observe(this.state);
    const ahead = this.facing ? { x: obs.player.x + DELTA[this.facing].x, y: obs.player.y + DELTA[this.facing].y } : null;
    const faced = ahead && options.find((a) => {
      const e = obs.entities.find((x) => x.id === a.targetId);
      return e && e.pos.x === ahead.x && e.pos.y === ahead.y;
    });
    this.dispatch(faced ?? (options[0] as GameAction));
  }

  interactToward(dir: Direction): void {
    const obs = observe(this.state);
    this.interactNear(obs.player.x + DELTA[dir].x + 0.5, obs.player.y + DELTA[dir].y + 0.5, 0.5);
  }

  /**
   * Interacts with the adjacent switch or block closest to a point on the board (tile units). Boards can be small on a
   * phone, so a tap within `reach` tiles of an adjacent target's centre counts; with two close targets the nearer wins.
   */
  interactNear(x: number, y: number, reach = 1.1): void {
    const obs = observe(this.state);
    let best: { id: string; d: number } | null = null;
    for (const e of obs.entities) {
      if (e.kind !== 'switch' && e.kind !== 'block') continue;
      if (Math.abs(obs.player.x - e.pos.x) + Math.abs(obs.player.y - e.pos.y) !== 1) continue;
      const d = Math.hypot(x - (e.pos.x + 0.5), y - (e.pos.y + 0.5));
      if (d <= reach && (!best || d < best.d)) best = { id: e.id, d };
    }
    if (best) this.dispatch({ type: 'INTERACT', targetId: best.id });
  }

  commit(): void {
    this.dispatch({ type: 'COMMIT' });
  }

  restart(): void {
    this.state = create(this.challenge, 'human-session');
    this.log.length = 0;
    this.scene?.present([{ type: 'RESET' }], observe(this.state));
    this.listeners.forEach((l) => l(this.snapshot([], null)));
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.game.destroy(true);
    this.listeners.clear();
  }
}
