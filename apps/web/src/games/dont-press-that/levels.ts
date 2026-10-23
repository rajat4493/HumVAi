import type { LevelDef } from './sim';

/**
 * The five levels. Every level is one screen (20 x 11 tiles), so the whole trap is always in view and a retry costs a second.
 * Legend:  # wall   . air   P start   E exit   ^ floor spikes   v ceiling spikes   * gravity star   B the button (a lure)
 *          R the button that ends the game   c cracked wall (a beam breaks it)
 * Each level has exactly one idea, and the rule behind it can be worked out by watching it happen twice.
 */
const solidRows = (n: number): string[] => Array.from({ length: n }, () => '#'.repeat(20));
const air = (n: number): string[] => Array.from({ length: n }, () => '.'.repeat(20));

export const LEVELS: readonly LevelDef[] = [
  {
    // 1. False Confidence. A hallway. The ceiling is not decoration.
    id: 'l1-false-confidence',
    n: 1,
    name: 'False Confidence',
    version: 1,
    rows: [...solidRows(2), ...air(3), '....B...............', '...###..............', '.'.repeat(20), '.P................E.', ...solidRows(2)],
    drops: [{ id: 'bar', x: 11, w: 2, y: 2, len: 1, trigger: { x: 10 }, tell: 14, speed: 30 }],
    zones: [],
    marks: [{ id: 'mid', x: 9.5 }, { id: 'past', x: 15 }],
    beams: 'off',
    button: 'drops',
    goal: 'exit',
  },
  {
    // 2. The Prediction. A short gap, and a host who is sure you will jump early.
    id: 'l2-the-prediction',
    n: 2,
    name: 'The Prediction',
    version: 1,
    rows: [...solidRows(4), ...air(4), '.P................E.', '#########...########', '#########...########'],
    drops: [],
    zones: [{ id: 'vents', from: 2, to: 8, spikeX: 8.6, spikeW: 2.6, y0: 4, len: 2.6, extend: 5, hold: 50 }],
    marks: [{ id: 'gap', x: 8 }],
    beams: 'off',
    button: 'none',
    goal: 'exit',
  },
  {
    // 3. The Betrayal. A helpful star. Stars turn gravity over.
    id: 'l3-the-betrayal',
    n: 3,
    name: 'The Betrayal',
    version: 1,
    rows: [
      ...solidRows(2),
      '........v.v.*.......',
      '............###.....',
      ...air(4),
      '.P..*.^^^^^....^..E.',
      ...solidRows(2),
    ],
    drops: [],
    zones: [],
    marks: [],
    beams: 'off',
    button: 'none',
    goal: 'exit',
  },
  {
    // 4. Mind Games. It aims where it thinks you will be, and it remembers what you did last time.
    id: 'l4-mind-games',
    n: 4,
    name: 'Mind Games',
    version: 1,
    rows: [...solidRows(2), ...air(6), '.P........^.......E.', '######..#######...##', '######..#######...##'],
    drops: [],
    zones: [],
    marks: [],
    beams: 'adaptive',
    button: 'none',
    goal: 'exit',
  },
  {
    // 5. Humiliate the AI. Everything you learned, and a wall the host will blow up for you.
    id: 'l5-humiliate-the-ai',
    n: 5,
    name: 'Humiliate the AI',
    version: 1,
    rows: [
      ...solidRows(2),
      '..........*.........',
      '.........###........',
      '..................c.',
      '..................c.',
      '..................c.',
      '..................c.',
      '.P.*.^^^^^........cR',
      ...solidRows(2),
    ],
    drops: [],
    zones: [],
    marks: [],
    beams: 'lead',
    button: 'goal',
    goal: 'button',
  },
];

export const levelByN = (n: number): LevelDef | undefined => LEVELS.find((l) => l.n === n);
export const levelById = (id: string): LevelDef | undefined => LEVELS.find((l) => l.id === id);
