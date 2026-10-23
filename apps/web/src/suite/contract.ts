import type { ComponentType } from 'react';

/** `available`: a finished game. `experimental`: playable but not a real release. `coming-soon`: a catalogue card only. */
export type GameStatus = 'available' | 'experimental' | 'coming-soon';

/** A short, honest summary for the home screen. `started` is false until the player has done something in the game. */
export interface GameProgress {
  label: string;
  started: boolean;
  /** 0..1, optional */
  fraction?: number;
}

/** What the suite hands a game: where inside the game the URL points, and a way home. A game owns everything below its own route. */
export interface GameProps {
  /** The part of the route after the game id, e.g. ['play', 'w05-garden-shifts'] for #/experiment/play/w05-garden-shifts. */
  route: string[];
  query: URLSearchParams;
  onHome: () => void;
}

/**
 * The whole contract. A game needs an id (also its URL segment), a name, a one-line description and a status.
 * Playable games add `load`, a lazy import of their entry component, so a game's code is fetched only when it is opened.
 * Nothing about rules, state or rendering is shared: each game owns its own.
 */
export interface GameModule {
  id: string;
  name: string;
  tagline: string;
  status: GameStatus;
  load?: () => Promise<{ default: ComponentType<GameProps> }>;
  progress?: () => GameProgress | null;
  /** Declared only when true; the home screen never claims an AI opponent a game does not have. */
  capabilities?: { verifiedAiRecordings?: boolean };
}

export const isPlayable = (g: GameModule): boolean => g.load !== undefined;
