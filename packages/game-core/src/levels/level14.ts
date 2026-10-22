import type { ChallengeDefinition } from '../types';

export const level14: ChallengeDefinition = {
  id: 'w14-reversal',
  version: 1,
  name: 'Reversal',
  briefing: 'The door is already open. Something here does not stay the way it is.',
  learning: 'A rule you relied on can reverse. Notice the change, then adapt.',
  difficulty: 4,
  budget: { explore: 14, execute: 10 },
  map: [
    '#########',
    '#@.w..DE#',
    '##a#b####',
    '#########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-one' },
    b: { kind: 'switch', id: 'switch-two' },
    w: { kind: 'tripwire', id: 'tripwire-tide' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchInitiallyOn: ['switch-one'],
    doors: {
      'door-exit': { op: 'on', id: 'switch-one' },
    },
    shift: {
      tripwire: 'tripwire-tide',
      doors: {
        'door-exit': { op: 'not', arg: { op: 'on', id: 'switch-one' } },
      },
    },
  },
};
