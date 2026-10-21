import type { ChallengeDefinition } from '../types';

export const level01: ChallengeDefinition = {
  id: 'w01-first-steps',
  version: 2,
  name: 'First Steps',
  briefing: 'Reach the glowing exit. Walls block the way.',
  learning: 'Movement, walls, and that every action spends budget.',
  difficulty: 1,
  budget: { explore: 0, execute: 12 },
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
