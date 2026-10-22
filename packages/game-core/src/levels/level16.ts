import type { ChallengeDefinition } from '../types';

export const level16: ChallengeDefinition = {
  id: 'w16-the-simple-way',
  version: 1,
  name: 'The Simple Way',
  briefing: 'A block, a plate, a door, and a rune. The obvious puzzle is not always the one you were given.',
  learning: 'When the world changes, check whether the hard part still matters.',
  difficulty: 5,
  budget: { explore: 26, execute: 10 },
  map: [
    '#########',
    '#@.B.p..#',
    '#.......#',
    '###w#####',
    '###D#####',
    '###E#####',
    '#########',
  ],
  legend: {
    B: { kind: 'block', id: 'block-grey' },
    p: { kind: 'plate', id: 'plate-weight' },
    w: { kind: 'tripwire', id: 'tripwire-tide' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    doors: {
      'door-exit': { op: 'on', id: 'plate-weight' },
    },
    shift: {
      tripwire: 'tripwire-tide',
      doors: {
        'door-exit': { op: 'not', arg: { op: 'on', id: 'plate-weight' } },
      },
    },
  },
};
