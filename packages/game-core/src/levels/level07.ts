import type { ChallengeDefinition } from '../types';

export const level07: ChallengeDefinition = {
  id: 'w07-off-is-on',
  version: 1,
  name: 'Off Is On',
  briefing: 'The exit is behind a door. Two switches glow. A glowing switch is not always a good sign.',
  learning: 'The state of the world matters, not just what you toggle.',
  difficulty: 2,
  budget: { explore: 16, execute: 12 },
  map: [
    '###########',
    '#@......DE#',
    '##a##b#####',
    '###########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-circle' },
    b: { kind: 'switch', id: 'switch-square' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchInitiallyOn: ['switch-circle', 'switch-square'],
    doors: {
      'door-exit': { op: 'or', args: [{ op: 'and', args: [{ op: 'on', id: 'switch-circle' }, { op: 'not', arg: { op: 'on', id: 'switch-square' } }] }, { op: 'and', args: [{ op: 'not', arg: { op: 'on', id: 'switch-circle' } }, { op: 'on', id: 'switch-square' }] }] },
    },
  },
};
