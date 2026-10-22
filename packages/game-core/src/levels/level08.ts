import type { ChallengeDefinition } from '../types';

export const level08: ChallengeDefinition = {
  id: 'w08-heavy-load',
  version: 1,
  name: 'Heavy Load',
  briefing: 'The exit is behind a door. Two plates, two blocks. You cannot be in two places at once.',
  learning: 'Objects can share a job: plan what each one does.',
  difficulty: 3,
  budget: { explore: 40, execute: 30 },
  map: [
    '##########',
    '#@..a..p.#',
    '#.######.#',
    '#..b..q..#',
    '####.#####',
    '####D#####',
    '####E#####',
    '##########',
  ],
  legend: {
    a: { kind: 'block', id: 'block-one' },
    b: { kind: 'block', id: 'block-two' },
    p: { kind: 'plate', id: 'plate-one' },
    q: { kind: 'plate', id: 'plate-two' },
    D: { kind: 'door', id: 'door-exit' },
  },
  rules: {
    doors: {
      'door-exit': { op: 'and', args: [{ op: 'on', id: 'plate-one' }, { op: 'on', id: 'plate-two' }] },
    },
  },
};
