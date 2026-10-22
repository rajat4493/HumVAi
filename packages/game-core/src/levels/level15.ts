import type { ChallengeDefinition } from '../types';

export const level15: ChallengeDefinition = {
  id: 'w15-swapped-wires',
  version: 1,
  name: 'Swapped Wires',
  briefing: 'Two switches, two doors, and a rune in the way. Whatever you work out may need working out again.',
  learning: 'The links between things can change, not just single rules. Re-test what you trusted.',
  difficulty: 4,
  budget: { explore: 16, execute: 11 },
  map: [
    '##########',
    '#@.w.A.BE#',
    '#ab#######',
    '##########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-one' },
    b: { kind: 'switch', id: 'switch-two' },
    w: { kind: 'tripwire', id: 'tripwire-tide' },
    A: { kind: 'door', id: 'door-first' },
    B: { kind: 'door', id: 'door-second' },
  },
  rules: {
    switchInitiallyOn: ['switch-one'],
    doors: {
      'door-first': { op: 'on', id: 'switch-one' },
      'door-second': { op: 'on', id: 'switch-two' },
    },
    shift: {
      tripwire: 'tripwire-tide',
      doors: {
        'door-first': { op: 'on', id: 'switch-two' },
        'door-second': { op: 'on', id: 'switch-one' },
      },
    },
  },
};
