import type { ChallengeDefinition } from '../types';

export const level05: ChallengeDefinition = {
  id: 'w05-garden-shifts',
  version: 1,
  name: 'The Garden Shifts',
  briefing: 'Two doors, two switches. What you learn may not stay true. You have 22 actions.',
  learning: 'The world can change its rules; a good strategy notices and adapts.',
  difficulty: 5,
  budget: 22,
  map: [
    '############',
    '#@..D..w.FE#',
    '#.a.#b.#####',
    '############',
  ],
  legend: {
    a: { kind: 'switch', id: 'switch-one' },
    b: { kind: 'switch', id: 'switch-two' },
    D: { kind: 'door', id: 'door-gate' },
    F: { kind: 'door', id: 'door-far' },
    w: { kind: 'tripwire', id: 'tripwire-tide' },
  },
  rules: {
    doors: {
      'door-gate': { op: 'on', id: 'switch-one' },
      'door-far': { op: 'on', id: 'switch-two' },
    },
    // Stepping on the tripwire inverts every door rule.
    shift: { tripwire: 'tripwire-tide' },
  },
};
