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
};

/** What the scene needs from whoever drives it: live play (GameController) or a recorded replay. */
export interface BoardController {
  readonly avatar: 'human' | 'ai';
  observe(): PublicGameState;
  attach(scene: GameScene): void;
  dispatch(action: GameAction): StepResult | null;
  interact(): void;
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
    (window as unknown as { __HVA__: unknown }).__HVA__ = { getState: () => observe(this.state), log: this.log };
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return; // holding a key must not burn budget
    if (document.querySelector('[aria-modal="true"]')) return; // dialogs own the keyboard
    const t = e.target;
    if (t instanceof HTMLElement && (t.closest('button, input, select, textarea, [role="switch"], [role="radio"]') !== null) && (e.key === ' ' || e.key === 'Enter')) return; // let focused controls activate natively
    const dir = KEYS[e.key];
    if (dir) {
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
    const result = step(this.state, action);
    if (result.valid) this.log.push(action);
    this.scene?.present(result.events, result.state);
    this.listeners.forEach((l) => l(this.snapshot(result.events, action)));
    return result;
  }

  /** Interacts with the adjacent switch; with several adjacent, the first (stable order). */
  interact(): void {
    const target = legalActions(this.state).find((a) => a.type === 'INTERACT');
    if (target) this.dispatch(target);
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
