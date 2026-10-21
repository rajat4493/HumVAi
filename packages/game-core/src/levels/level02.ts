import type { ChallengeDefinition } from '../types';

export const level02: ChallengeDefinition = {
  id: 'w02-orange-switch',
  version: 1,
  name: 'The Orange Switch',
  briefing: 'The exit is behind a door. Two switches sit nearby. Find out what they do. You have 14 actions.',
  learning: 'Switches change the world; some switches matter and some do not.',
  difficulty: 2,
  budget: 14,
  map: [
    '#########',
    '#@..#..E#',
    '#.a.D...#',
    '#.b.#...#',
    '#########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-orange' },
    b: { kind: 'switch', id: 'switch-teal' },
    D: { kind: 'door', id: 'door-garden' },
  },
  // Only the orange switch controls the door. The teal switch is a decoy.
  rules: { doors: { 'door-garden': { op: 'on', id: 'switch-orange' } } },
};
