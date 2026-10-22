import type { ChallengeDefinition } from '../types';

export const level12: ChallengeDefinition = {
  id: 'w12-against-the-wall',
  version: 1,
  name: 'Against the Wall',
  briefing: 'The exit is behind a door. The grey block is stuck in the corner.',
  learning: 'Pushing is not the only way to move a block: Interact pulls it.',
  difficulty: 3,
  budget: { explore: 24, execute: 18 },
  map: [
    '#########',
    '#@......#',
    '#.#####.#',
    '#...p..B#',
    '#D#######',
    '#E#######',
    '#########',
  ],
  legend: {
    B: { kind: 'block', id: 'block-grey' },
    p: { kind: 'plate', id: 'plate-floor' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    doors: {
      'door-exit': { op: 'on', id: 'plate-floor' },
    },
  },
};
