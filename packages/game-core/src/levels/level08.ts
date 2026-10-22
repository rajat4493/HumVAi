import type { ChallengeDefinition } from '../types';

export const level08: ChallengeDefinition = {
  id: 'w08-heavy-load',
  version: 3,
  name: 'Heavy Load',
  briefing: 'The exit is behind a door. Two plates, two blocks, and a way forward that is not open yet.',
  learning: 'Objects can share a job, and one job can unlock the next: plan the order.',
  difficulty: 4,
  budget: { explore: 22, execute: 17 },
  map: [
    '########',
    '#@.....#',
    '#..a.p.#',
    '######G#',
    '#.q.b..#',
    '###D####',
    '###E####',
    '########',
  ],
  legend: {
    a: { kind: 'block', id: 'block-one' },
    b: { kind: 'block', id: 'block-two' },
    p: { kind: 'plate', id: 'plate-one' },
    q: { kind: 'plate', id: 'plate-two' },
    G: { kind: 'door', id: 'door-gate' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    doors: {
      'door-gate': { op: 'on', id: 'plate-one' },
      'door-exit': { op: 'and', args: [{ op: 'on', id: 'plate-one' }, { op: 'on', id: 'plate-two' }] },
    },
  },
};
