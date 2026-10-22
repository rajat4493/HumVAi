import type { ChallengeDefinition } from '../types';

export const level17: ChallengeDefinition = {
  id: 'w17-spring-loaded',
  version: 1,
  name: 'Spring Loaded',
  briefing: 'The exit is behind a door, and the switch is a long way from it.',
  learning: 'Some things do not stay as you leave them. Time is a resource too.',
  difficulty: 3,
  budget: { explore: 20, execute: 13 },
  map: [
    '##########',
    '#@.......#',
    '#.s#####.#',
    '########D#',
    '########E#',
    '##########',
  ],
  legend: {
    s: { kind: 'switch', id: 'switch-spring' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchTimers: { 'switch-spring': 9 },
    doors: {
      'door-exit': { op: 'on', id: 'switch-spring' },
    },
  },
};
