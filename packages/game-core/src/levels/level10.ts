import type { ChallengeDefinition } from '../types';

export const level10: ChallengeDefinition = {
  id: 'w10-in-order',
  version: 2,
  name: 'In Order',
  briefing: 'Three switches, one door. Some of them refuse to move until something else has.',
  learning: 'Dependencies form a chain: find the order, then the final twist.',
  difficulty: 4,
  budget: { explore: 15, execute: 20 },
  map: [
    '##########',
    '#@.....DE#',
    '#.a.b.c.##',
    '##########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-one' },
    b: { kind: 'switch', id: 'switch-two' },
    c: { kind: 'switch', id: 'switch-three' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchEnabled: {
      'switch-two': { op: 'on', id: 'switch-one' },
      'switch-three': { op: 'on', id: 'switch-two' },
    },
    doors: {
      'door-exit': { op: 'and', args: [{ op: 'on', id: 'switch-three' }, { op: 'not', arg: { op: 'on', id: 'switch-one' } }] },
    },
  },
};
