import type { ChallengeDefinition } from '../types';

export const level20: ChallengeDefinition = {
  id: 'w20-the-last-experiment',
  version: 1,
  name: 'The Last Experiment',
  briefing: 'Everything you have learned, in one place. The exit is sealed, and you have not been told by what.',
  learning: 'Combine it all: prepare, discover what changes the world, then act before time runs out.',
  difficulty: 5,
  budget: { explore: 26, execute: 32 },
  map: [
    '##########',
    '#@.B.p...#',
    '#........#',
    '#######G##',
    '#..s.....#',
    '#w.......#',
    '#######X##',
    '#######E##',
    '##########',
  ],
  legend: {
    B: { kind: 'block', id: 'block-grey' },
    p: { kind: 'plate', id: 'plate-weight' },
    s: { kind: 'switch', id: 'switch-spring' },
    w: { kind: 'tripwire', id: 'tripwire-tide' },
    G: { kind: 'door', id: 'door-gate' },
    X: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchTimers: { 'switch-spring': 6 },
    doors: {
      'door-gate': { op: 'on', id: 'plate-weight' },
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
