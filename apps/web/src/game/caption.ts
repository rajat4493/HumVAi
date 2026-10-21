import type { GameAction, GameEvent } from '@hva/game-core';
import type { ReplayStep } from './replay';

const DIR: Record<string, string> = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };
const nice = (id: string) => id.replace(/^(switch|door|plate|block|tripwire)-/, '$1 ').replace(/-/g, ' ');

/** Plain-words caption for one recorded step, generated from engine events (never from model text). */
export function captionFor(step: Pick<ReplayStep, 'action' | 'valid' | 'events'>): string {
  const { action, valid, events } = step;
  if (!action) return "The reply could not be read, so nothing happened (it counted as a rejected action).";
  if (!valid) return 'That action was not allowed, so nothing happened.';
  const has = (t: GameEvent['type']) => events.some((e) => e.type === t);
  const parts: string[] = [];
  const act = action as GameAction;
  switch (act.type) {
    case 'MOVE':
      if (has('PUSHED')) parts.push(`Moved ${DIR[act.direction]} and pushed the block`);
      else if (has('BLOCKED')) parts.push(`Tried to move ${DIR[act.direction]} but was blocked`);
      else parts.push(`Moved ${DIR[act.direction]}`);
      break;
    case 'INTERACT':
      if (has('NO_EFFECT')) parts.push(`Tried the ${nice(act.targetId)}: nothing happened`);
      else if (has('PULLED')) parts.push('Dragged the block');
      else {
        const t = events.find((e) => e.type === 'SWITCH_TOGGLED');
        parts.push(`Switched the ${nice(act.targetId)} ${t && t.type === 'SWITCH_TOGGLED' && t.on ? 'on' : 'off'}`);
      }
      break;
    case 'RESET':
      parts.push('Reset the world');
      break;
    case 'COMMIT':
      parts.push('Ended scouting: the run begins on a fresh world');
      break;
  }
  if (has('DOOR_OPENED')) parts.push('a door opened');
  if (has('DOOR_CLOSED')) parts.push('a door closed');
  if (has('PLATE_PRESSED')) parts.push('a plate was pressed');
  if (has('PLATE_RELEASED')) parts.push('a plate was released');
  if (has('EPOCH_CHANGED')) parts.push('the world changed its rules');
  if (has('EXIT_FOUND')) parts.push('the exit was reached while scouting (nothing is won yet)');
  if (has('WON')) parts.push('reached the exit');
  if (has('LOST')) parts.push('out of actions');
  const [first, ...rest] = parts;
  return `${first as string}${rest.length ? `; ${rest.join('; ')}` : ''}.`;
}

/** Tick category for the timeline strip. */
export function tickKind(step: Pick<ReplayStep, 'action' | 'valid' | 'events'>): 'move' | 'bump' | 'interact' | 'noeffect' | 'reset' | 'commit' | 'rejected' | 'change' {
  if (!step.action || !step.valid) return 'rejected';
  if (step.events.some((e) => e.type === 'EPOCH_CHANGED')) return 'change';
  if (step.action.type === 'COMMIT') return 'commit';
  if (step.action.type === 'RESET') return 'reset';
  if (step.events.some((e) => e.type === 'NO_EFFECT')) return 'noeffect';
  if (step.action.type === 'INTERACT') return 'interact';
  if (step.events.some((e) => e.type === 'BLOCKED')) return 'bump';
  return 'move';
}
