import type { GameAction } from '@hva/game-core';

export const SAVE_KEY = 'hva.save.v1';
export const SESSION_KEY = 'hva.session.v1';

export interface LevelProgress {
  completed: boolean;
  attempts: number;
  wins: number;
  /** Fewest run actions in any win, hinted or not. */
  bestRun: number | null;
  /** Fewest run actions in a win with no hints (the personal best that counts). */
  bestUnassistedRun: number | null;
  /** Action log of the best unassisted win; replayable through the engine. */
  bestActions: GameAction[] | null;
  firstWonAt: string | null;
  usedHints: boolean;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  /** 0..1 master volume. */
  volume: number;
  motion: 'system' | 'reduced' | 'full';
}

export interface SaveData {
  v: 1;
  levels: Record<string, LevelProgress>;
  achievements: Record<string, { at: string; levelId: string | null }>;
  settings: Settings;
}

/** A run in progress, so a refresh or closed tab never loses it. */
export interface Session {
  v: 1;
  levelId: string;
  levelVersion: number;
  actions: GameAction[];
  hintsUsed: number;
  startedAt: string;
}

export const DEFAULT_SETTINGS: Settings = { sound: true, music: true, volume: 0.7, motion: 'system' };
