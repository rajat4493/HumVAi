import type { ChallengeDefinition } from '../types';

export const level11: ChallengeDefinition = {
  id: 'w11-corner-piece',
  version: 1,
  name: 'Corner Piece',
  briefing: 'The exit is behind a door. The grey block can be pushed, and dragged with Interact.',
  learning: 'A block only goes where you can stand behind it. Plan the turn.',
  difficulty: 3,
  budget: { explore: 22, execute: 18 },
  map: [
    '#########',
    '#@......#',
    '#.B.....#',
    '#D####p##',
    '#E#######',
  ],
  legend: {
    B: { kind: 'block', id: 'block-grey' },
    p: { kind: 'plate', id: 'plate-niche' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    doors: {
      'door-exit': { op: 'on', id: 'plate-niche' },
    },
  },
};
