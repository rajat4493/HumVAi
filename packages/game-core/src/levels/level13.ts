import type { ChallengeDefinition } from '../types';

export const level13: ChallengeDefinition = {
  id: 'w13-combination',
  version: 1,
  name: 'Combination',
  briefing: 'Four switches around a room, one door. Learn what the door really asks for, then do it with as few actions as you can.',
  learning: 'A door can combine several conditions. Test, watch the door, and work out which switches matter.',
  difficulty: 4,
  budget: { explore: 16, execute: 15 },
  map: [
    '##########',
    '#.a....b.#',
    '#@.......#',
    '#.c....d.#',
    '####D#####',
    '####E#####',
    '##########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-one' },
    b: { kind: 'switch', id: 'switch-two' },
    c: { kind: 'switch', id: 'switch-three' },
    d: { kind: 'switch', id: 'switch-four' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchInitiallyOn: ['switch-four'],
    doors: {
      'door-exit': { op: 'and', args: [{ op: 'and', args: [{ op: 'on', id: 'switch-one' }, { op: 'not', arg: { op: 'on', id: 'switch-four' } }] }, { op: 'or', args: [{ op: 'on', id: 'switch-two' }, { op: 'on', id: 'switch-three' }] }] },
    },
  },
};
