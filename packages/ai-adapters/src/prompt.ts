import type { GameAction, GameEvent, PublicGameState } from '@hva/game-core';
import { renderAscii } from '@hva/game-core';
import type { ChatMessage } from './types';

export const PROMPT_VERSION = 'hva.prompt.2';

/** Identical for every world and every model. Hashed into every record. */
export const SYSTEM_PROMPT = `You are playing a small puzzle game by choosing one action at a time.
Each turn you receive the current state of the world, what your last action caused, and the actions
that are legal right now. Reply with exactly one JSON object: {"action": <action>, "note": <optional short sentence>}.

The world is a grid. '#' is wall, '.' is floor, '@' is you, 'E' is the exit. Other things are listed
as entities with an id, a kind and a state. Some of how this world behaves is not told to you. You can
only find out by acting and watching what happens.

Actions:
- MOVE with direction UP, DOWN, LEFT or RIGHT: move one tile. If something blocks you, you stay where you are
  (it still counts as an action). Walking into a block pushes it one tile if there is room.
- INTERACT with targetId: acts on an adjacent switch (toggles it) or an adjacent block (drags it: you step
  directly away and it follows). Only things next to you can be targeted.
- RESET: put the world back to how it started.
- COMMIT: only while scouting. Ends scouting and starts the run.

The game has two phases. Scout: a practice world where nothing can be won or lost; RESET is free; you have a
limited number of actions. The Run: a fresh world, strict action limit, RESET costs one action. You win by
reaching the exit during the Run. Reaching the exit while scouting wins nothing and does not end scouting:
you stay in the practice world until you choose COMMIT (or your scouting actions run out).
What you learned while scouting is yours to use in the Run; the world itself is reset.
Your goal: reach the exit during the Run using as few actions as you can.

Action formats, for example:
{"action": {"type": "MOVE", "direction": "RIGHT"}}
{"action": {"type": "INTERACT", "targetId": "<id of an adjacent entity>"}}
{"action": {"type": "RESET"}}
{"action": {"type": "COMMIT"}}`;

/**
 * The only information a participant gets each turn: the level's briefing (same text a human reads),
 * the public observation, the events caused by the last action, and the legal actions.
 */
export function buildTurnMessage(args: {
  briefing: string;
  observation: PublicGameState;
  lastEvents: GameEvent[] | null;
  legalActions: GameAction[];
  rejection: string | null;
}): string {
  const { briefing, observation: o, lastEvents, legalActions, rejection } = args;
  const phase =
    o.phase === 'explore'
      ? `SCOUT: ${o.scout.used}/${o.scout.budget} actions used. Run budget when it starts: ${o.run.budget}.`
      : `RUN: ${o.run.used}/${o.run.budget} actions used.${o.scout.budget > 0 ? ` (Scouting used ${o.scout.used}/${o.scout.budget}.)` : ''}`;
  return [
    `BRIEFING\n${briefing}`,
    `PHASE\n${phase}`,
    `OBSERVATION\n${JSON.stringify(o)}`,
    `BOARD\n${renderAscii(o)}`,
    `LAST ACTION RESULT\n${rejection ? `REJECTED: ${rejection}` : lastEvents ? JSON.stringify(lastEvents) : 'none (first turn)'}`,
    `LEGAL ACTIONS\n${JSON.stringify(legalActions)}`,
  ].join('\n\n');
}

export interface Turn {
  user: string;
  /** Exact text the model replied with; absent for the turn being asked now. */
  assistant?: string;
}

/** Full, untruncated history in order, ending with the turn being asked now. */
export function buildMessages(history: Turn[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const t of history) {
    out.push({ role: 'user', content: t.user });
    if (t.assistant !== undefined) out.push({ role: 'assistant', content: t.assistant });
  }
  return out;
}
