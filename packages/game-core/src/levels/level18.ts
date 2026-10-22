import type { ChallengeDefinition } from '../types';

export const level18: ChallengeDefinition = {
  id: 'w18-two-springs',
  version: 1,
  name: 'Two Springs',
  briefing: 'Two switches at opposite ends, one door between them. Neither seems to stay on.',
  learning: 'When several timed things must overlap, the order you do them in decides everything.',
  difficulty: 4,
  budget: { explore: 26, execute: 20 },
  map: [
    '###########',
    '#a...@...b#',
    '#####D#####',
    '#####E#####',
    '###########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-left' },
    b: { kind: 'switch', id: 'switch-right' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchTimers: { 'switch-left': 12, 'switch-right': 5 },
    doors: {
      'door-exit': { op: 'and', args: [{ op: 'on', id: 'switch-left' }, { op: 'on', id: 'switch-right' }] },
    },
  },
};
