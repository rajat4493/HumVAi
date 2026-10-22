import type { ChallengeDefinition } from '../types';

export const level19: ChallengeDefinition = {
  id: 'w19-two-of-three',
  version: 2,
  name: 'Two of Three',
  briefing: 'Three switches and a door. None of them stays lit for long, and they do not last equally long.',
  learning: 'Find the rule, find which switch lasts longest, and put them in the right order.',
  difficulty: 5,
  budget: { explore: 20, execute: 15 },
  map: [
    '#########',
    '####E####',
    '####D####',
    '#.......#',
    '#a.....b#',
    '#...@...#',
    '#...c...#',
    '#########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-one' },
    b: { kind: 'switch', id: 'switch-two' },
    c: { kind: 'switch', id: 'switch-three' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchTimers: { 'switch-one': 5, 'switch-two': 5, 'switch-three': 9 },
    doors: {
      'door-exit': { op: 'or', args: [{ op: 'and', args: [{ op: 'on', id: 'switch-one' }, { op: 'on', id: 'switch-two' }] }, { op: 'and', args: [{ op: 'on', id: 'switch-one' }, { op: 'on', id: 'switch-three' }] }, { op: 'and', args: [{ op: 'on', id: 'switch-two' }, { op: 'on', id: 'switch-three' }] }] },
    },
  },
};
