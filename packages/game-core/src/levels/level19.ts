import type { ChallengeDefinition } from '../types';

export const level19: ChallengeDefinition = {
  id: 'w19-chain-reaction',
  version: 1,
  name: 'Chain Reaction',
  briefing: 'Three switches around a room. Some will not move until another is lit, and nothing stays lit for long.',
  learning: 'Dependencies and timing together: set the chain in motion and keep ahead of it.',
  difficulty: 5,
  budget: { explore: 22, execute: 24 },
  map: [
    '##########',
    '#@a......#',
    '#........#',
    '#.....b..#',
    '#........#',
    '#c.......#',
    '#######D##',
    '#######E##',
    '##########',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-one' },
    b: { kind: 'switch', id: 'switch-two' },
    c: { kind: 'switch', id: 'switch-three' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    switchTimers: { 'switch-one': 8, 'switch-two': 8 },
    switchEnabled: {
      'switch-two': { op: 'on', id: 'switch-one' },
      'switch-three': { op: 'on', id: 'switch-two' },
    },
    doors: {
      'door-exit': { op: 'on', id: 'switch-three' },
    },
  },
};
