import type { ChallengeDefinition } from '../types';

export const level09: ChallengeDefinition = {
  id: 'w09-hold-the-line',
  version: 1,
  name: 'Hold the Line',
  briefing: 'The exit is behind a door. A switch waits in the corner, and a grey block rests nearby.',
  learning: 'A rule can depend on something you are holding, not just on other switches.',
  difficulty: 3,
  budget: { explore: 26, execute: 16 },
  map: [
    '#########',
    '#@......#',
    '#.B.p.a.#',
    '#...###D#',
    '#######E#',
    '#########',
  ],
  legend: {
    B: { kind: 'block', id: 'block-grey' },
    p: { kind: 'plate', id: 'plate-weight' },
    a: { kind: 'switch', id: 'switch-latch' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchEnabled: {
      'switch-latch': { op: 'on', id: 'plate-weight' },
    },
    doors: {
      'door-exit': { op: 'on', id: 'switch-latch' },
    },
  },
};
