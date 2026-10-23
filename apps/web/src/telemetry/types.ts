import type { GameAction } from '@hva/game-core';

export const TELEMETRY_SCHEMA = 'hva.telemetry.1';
/** Bumped whenever the data policy text changes, so consent is always recorded against the wording the player saw. */
export const POLICY_VERSION = 'draft-2';
export const STORE_KEY = 'hva.telemetry.v1';
export const CONSENT_KEY = 'hva.telemetry.consent.v1';

/** One valid action, in the order played. Observations are not stored: they are derived by replaying the actions through the engine; `h` lets a reader prove that. */
export interface TAction {
  i: number;
  /** Milliseconds since the attempt began, rounded to 10 ms. */
  t: number;
  phase: 'explore' | 'execute';
  a: GameAction;
  /** Engine event types the action caused (names only). */
  ev: string[];
  /** Hash of the observation the player saw after the action (same function the AI recordings use). */
  h: string;
}

export interface THint {
  /** 1..3 */
  tier: number;
  t: number;
  /** Number of actions taken when the hint was opened. */
  atAction: number;
}

export interface TOutcome {
  status: 'won' | 'lost' | 'abandoned';
  runActions: number;
  scoutActions: number;
  scoutResets: number;
  runResets: number;
  assisted: boolean;
  durationMs: number;
}

export interface TAttempt {
  /** Random, per attempt. Nothing links attempts to a person or a device. */
  id: string;
  levelId: string;
  levelVersion: number;
  /** ISO time rounded down to the hour. */
  startedAt: string;
  device: 'touch' | 'pointer';
  /** Actions already played when a refreshed attempt was resumed (replayed silently by the game); needed to verify the rest. */
  prefix: GameAction[];
  /** Hash of the observation at the start. */
  start: string;
  actions: TAction[];
  hints: THint[];
  /** null while in progress. */
  outcome: TOutcome | null;
}

export interface TelemetryFile {
  schema: typeof TELEMETRY_SCHEMA;
  policyVersion: string;
  appVersion: string;
  /** Date only. */
  exportedAt: string;
  attempts: TAttempt[];
}

export interface Consent {
  granted: boolean;
  /** Date only. */
  at: string;
  policyVersion: string;
}
