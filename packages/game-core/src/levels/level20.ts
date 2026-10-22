import type { ChallengeDefinition } from '../types';

export const level20: ChallengeDefinition = {
  id: 'w20-the-last-experiment',
  version: 2,
  name: 'The Last Experiment',
  briefing: 'Everything you have learned, in one room. The exit is sealed, and you have not been told by what.',
  learning: 'Combine it all: find what changes the world, set it up, then act before time runs out.',
  difficulty: 5,
  budget: { explore: 30, execute: 19 },
  map: [
    '#########',
    '#@.B.p..#',
    '#.......#',
    '#.s...w.#',
    '#.......#',
    '####X####',
    '####E####',
    '#########',
  ],
  legend: {
    B: { kind: 'block', id: 'block-grey' },
    p: { kind: 'plate', id: 'plate-weight' },
    s: { kind: 'switch', id: 'switch-spring' },
    w: { kind: 'tripwire', id: 'tripwire-tide' },
    X: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchTimers: { 'switch-spring': 4 },
    doors: {
      'door-exit': { op: 'const', value: false },
    },
    shift: {
      tripwire: 'tripwire-tide',
      doors: {
        'door-exit': { op: 'and', args: [{ op: 'on', id: 'switch-spring' }, { op: 'on', id: 'plate-weight' }] },
      },
    },
  },
};
