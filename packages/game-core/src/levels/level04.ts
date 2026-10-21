import type { ChallengeDefinition } from '../types';

export const level04: ChallengeDefinition = {
  id: 'w04-only-when',
  version: 2,
  name: 'Only When',
  briefing: 'The exit is behind a door. Three switches line the corridor. Not everything works all the time.',
  learning: 'An action can depend on the state of something else. Failure is information.',
  difficulty: 4,
  budget: { explore: 14, execute: 11 },
  map: [
    '##########',
    '#@.....DE#',
    '#.a.b.c###',
    '##########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-circle' },
    b: { kind: 'switch', id: 'switch-square' },
    c: { kind: 'switch', id: 'switch-triangle' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    // The triangle switch is jammed while the circle switch is ON (circle starts ON).
    switchInitiallyOn: ['switch-circle'],
    switchEnabled: { 'switch-triangle': { op: 'not', arg: { op: 'on', id: 'switch-circle' } } },
    // The door opens when triangle is ON, but the square switch overrides it.
    doors: {
      'door-exit': { op: 'and', args: [{ op: 'on', id: 'switch-triangle' }, { op: 'not', arg: { op: 'on', id: 'switch-square' } }] },
    },
  },
};
