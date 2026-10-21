import { create, evaluate, step } from './engine';
import type { ChallengeDefinition, GameAction, GameEvent, GameOutcome, Phase } from './types';

export interface RunAnalysis {
  outcome: GameOutcome;
  events: { phase: Phase; event: GameEvent }[];
  /** RESET actions taken during the Run (a Scout reset is free and part of experimenting). */
  runResets: number;
  scoutResets: number;
  extraActions: boolean;
}

/** Re-executes an action log and records every event with the phase it happened in. Pure and deterministic. */
export function analyzeRun(level: ChallengeDefinition, actions: GameAction[], seed = 'analysis'): RunAnalysis {
  const state = create(level, seed);
  const events: RunAnalysis['events'] = [];
  let runResets = 0;
  let scoutResets = 0;
  let extra = false;
  for (const a of actions) {
    if (state.status !== 'playing') {
      extra = true;
      break;
    }
    const phase = state.phase;
    const r = step(state, a);
    if (r.valid && a.type === 'RESET') {
      if (phase === 'explore') scoutResets += 1;
      else runResets += 1;
    }
    for (const event of r.events) events.push({ phase, event });
  }
  return { outcome: { ...evaluate(state), extraActions: extra }, events, runResets, scoutResets, extraActions: extra };
}
