import type { ChallengeDefinition } from '../types';

export const level01: ChallengeDefinition = {
  id: 'w01-first-steps',
  version: 1,
  name: 'First Steps',
  briefing: 'Reach the glowing exit. Walls block the way. You have 12 actions.',
  learning: 'Movement, walls, and that every action spends budget.',
  difficulty: 1,
  budget: 12,
  map: [
    '#######',
    '#@..#E#',
    '#.#.#.#',
    '#.#...#',
    '#######',
  ],
  legend: {},
  rules: { doors: {} },
};
