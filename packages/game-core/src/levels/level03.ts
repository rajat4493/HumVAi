import type { ChallengeDefinition } from '../types';

export const level03: ChallengeDefinition = {
  id: 'w03-locked-garden',
  version: 1,
  name: 'The Locked Garden',
  briefing: 'The exit is behind a door. The purple block can be moved. Discover how the world works. You have 16 actions.',
  learning: 'Objects can do what the player cannot: hold a plate while you walk away.',
  difficulty: 3,
  budget: 16,
  map: [
    '#########',
    '#@......#',
    '#.B.p##D#',
    '#...###E#',
    '#########',
  ],
  legend: {
    B: { kind: 'block', id: 'block-purple' },
    p: { kind: 'plate', id: 'plate-garden' },
    D: { kind: 'door', id: 'door-garden' },
  },
  rules: { doors: { 'door-garden': { op: 'on', id: 'plate-garden' } } },
};
