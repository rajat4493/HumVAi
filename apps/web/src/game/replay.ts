import type Phaser from 'phaser';
import type { ChallengeDefinition, GameAction, GameEvent, GameState, Phase, PublicGameState, StepResult } from '@hva/game-core';
import { create, observe, step } from '@hva/game-core';
import type { BoardController } from './controller';
import type { GameScene } from './GameScene';
import { createBoard } from './host';

export interface ReplayStep {
  i: number;
  phase: Phase;
  /** Null when the recorded reply could not be read (it counted as a rejected action and changed nothing). */
  action: GameAction | null;
  valid: boolean;
  events: GameEvent[];
  note: string | null;
}

/**
 * Drives the same board the player uses from a recorded action list. It never decides anything:
 * every state comes from re-executing the recorded actions through the deterministic engine.
 */
export class ReplayController implements BoardController {
  private state: GameState;
  private scene: GameScene | null = null;
  private game: Phaser.Game;
  private index = 0;

  constructor(
    parent: HTMLElement,
    private readonly level: ChallengeDefinition,
    private readonly seed: string,
    readonly steps: ReplayStep[],
    readonly avatar: 'human' | 'ai',
  ) {
    this.state = create(level, seed);
    this.game = createBoard(parent, this);
  }

  attach(scene: GameScene): void {
    this.scene = scene;
  }
  observe(): PublicGameState {
    return observe(this.state);
  }
  dispatch(): StepResult | null {
    return null; // replays take no input
  }
  interact(): void {
    /* no input */
  }

  get position(): number {
    return this.index;
  }

  /** Jumps to the world as it was before step `i`, without animation. */
  seekTo(i: number): void {
    const target = Math.max(0, Math.min(this.steps.length, i));
    this.state = create(this.level, this.seed);
    for (let k = 0; k < target; k++) {
      const a = this.steps[k]?.action;
      if (a) step(this.state, a);
    }
    this.index = target;
    this.scene?.present([{ type: 'RESET' }], observe(this.state));
  }

  /** Plays the next recorded step with its animation. Returns it, or null at the end. */
  next(): ReplayStep | null {
    const s = this.steps[this.index];
    if (!s) return null;
    this.index += 1;
    if (s.action) {
      const r = step(this.state, s.action);
      this.scene?.present(r.events, r.state);
    }
    return s;
  }

  destroy(): void {
    this.game.destroy(true);
  }
}

/** Steps of a recorded attempt, exactly as recorded (including replies that could not be read). */
export function stepsFromRecord(record: { steps: { i: number; phase: Phase; action: GameAction | null; valid: boolean; events: GameEvent[]; note: string | null }[] }): ReplayStep[] {
  return record.steps.map((s) => ({ i: s.i, phase: s.phase, action: s.action, valid: s.valid, events: s.events, note: s.note }));
}

/** Steps for an action list (e.g. the computed shortest solution), by executing it through the engine. */
export function stepsFromActions(level: ChallengeDefinition, actions: GameAction[], seed: string): ReplayStep[] {
  const state = create(level, seed);
  const out: ReplayStep[] = [];
  for (const [i, a] of actions.entries()) {
    const phase = state.phase;
    const r = step(state, a);
    out.push({ i, phase, action: a, valid: r.valid, events: r.events, note: null });
  }
  return out;
}
