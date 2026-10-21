import type { ChallengeDefinition } from '../types';

export const level05: ChallengeDefinition = {
  id: 'w05-garden-shifts',
  version: 2,
  name: 'The Garden Shifts',
  briefing: 'Two doors, two switches, and a strange rune. What you learn may not stay true.',
  learning: 'The world can change its rules; what you learned about a switch may stop (or start) being true.',
  difficulty: 5,
  budget: { explore: 20, execute: 16 },
  map: [
    '############',
    '#@..D....FE#',
    '#.a.#.w.b###',
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
      // Before the tide turns the far door is sealed: nothing opens it.
      'door-far': { op: 'const', value: false },
    },
    // Stepping on the rune turns the tide: from then on switch-two controls the far door.
    shift: { tripwire: 'tripwire-tide', doors: { 'door-far': { op: 'on', id: 'switch-two' } } },
  },
};
