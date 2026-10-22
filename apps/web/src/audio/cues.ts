import type { GameAction, GameEvent } from '@hva/game-core';

export type CueId =
  | 'step' | 'bump' | 'push' | 'drag' | 'switch_on' | 'switch_off' | 'no_effect' | 'door_open' | 'door_close'
  | 'plate_down' | 'plate_up' | 'shift' | 'commit' | 'reset' | 'exit_found' | 'win' | 'loss' | 'ui_click'
  | 'reveal_human' | 'reveal_ai' | 'reveal_tie' | 'reveal_none' | 'ai_step' | 'spring_pop' | 'campaign_complete';

/** Which sounds an action's events should produce. At most three, most important first, no double-counting of a move. */
export function cuesForEvents(events: GameEvent[], action: GameAction | null = null): CueId[] {
  const out: CueId[] = [];
  const has = (t: GameEvent['type']) => events.some((e) => e.type === t);
  for (const e of events) {
    switch (e.type) {
      case 'WON': out.push('win'); break;
      case 'LOST': out.push('loss'); break;
      case 'EPOCH_CHANGED': out.push('shift'); break;
      case 'COMMITTED': out.push('commit'); break;
      case 'RESET': if (!has('COMMITTED')) out.push('reset'); break;
      case 'EXIT_FOUND': out.push('exit_found'); break;
      case 'NO_EFFECT': out.push('no_effect'); break;
      case 'SWITCH_TOGGLED': {
        // A switch that went off during something other than a press of that switch sprang back by itself.
        const byHand = action ? action.type === 'INTERACT' && action.targetId === e.id : !has('MOVED') && !has('BLOCKED') && !has('PUSHED') && !has('PULLED');
        out.push(e.on ? 'switch_on' : byHand ? 'switch_off' : 'spring_pop');
        break;
      }
      case 'DOOR_OPENED': out.push('door_open'); break;
      case 'DOOR_CLOSED': out.push('door_close'); break;
      case 'PLATE_PRESSED': out.push('plate_down'); break;
      case 'PLATE_RELEASED': out.push('plate_up'); break;
      case 'PUSHED': out.push('push'); break;
      case 'PULLED': out.push('drag'); break;
      case 'BLOCKED': out.push('bump'); break;
      case 'MOVED': if (!has('PUSHED') && !has('PULLED')) out.push('step'); break;
      default: break;
    }
  }
  // Outcome and world-change sounds win over incidental ones when trimmed.
  const rank = (c: CueId) => (['win', 'loss', 'shift', 'commit', 'exit_found'].includes(c) ? 0 : ['switch_on', 'switch_off', 'spring_pop', 'door_open', 'door_close', 'no_effect'].includes(c) ? 1 : 2);
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b)).slice(0, 3);
}
