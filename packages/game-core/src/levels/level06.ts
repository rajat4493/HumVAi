import type { ChallengeDefinition } from '../types';

export const level06: ChallengeDefinition = {
  id: 'w06-both-needed',
  version: 2,
  name: 'Both Needed',
  briefing: 'The exit is behind a door, with a switch at each end of the corridor. Find out what it takes.',
  learning: 'Some things need more than one condition at once.',
  difficulty: 2,
  budget: { explore: 20, execute: 16 },
  map: [
    '#########',
    '#a..@..b#',
    '###cD####',
    '####E####',
    '#########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-left' },
    b: { kind: 'switch', id: 'switch-right' },
    c: { kind: 'switch', id: 'switch-middle' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    doors: {
      'door-exit': { op: 'and', args: [{ op: 'on', id: 'switch-left' }, { op: 'on', id: 'switch-right' }] },
    },
  },
};
