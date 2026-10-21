import { LEVELS } from './levels';
import type { ChallengeDefinition } from './types';

export interface CampaignLevel {
  levelId: string;
  /** Three tiers, escalating: what to look at, the rule, the route. Using any hint marks the run as assisted. */
  hints: [string, string, string];
}

export interface Chapter {
  id: string;
  name: string;
  blurb: string;
  levels: CampaignLevel[];
}

/**
 * Chapter placement is metadata: level ids stay stable. Only built levels are listed; the table grows
 * toward the 20-level plan (5 chapters x 4) as levels pass the solver gates.
 */
export const CAMPAIGN: readonly Chapter[] = [
  {
    id: 'ch1',
    name: 'Awakening',
    blurb: 'Move, look, and learn that the world has rules you were not told.',
    levels: [
      {
        levelId: 'w01-first-steps',
        hints: [
          'Walls block you. Find a path to the glowing exit.',
          'The left corridor is a dead end. Go around the pillar.',
          'Right, right, down, down, right, right, up, up.',
        ],
      },
      {
        levelId: 'w02-orange-switch',
        hints: [
          'Not every switch matters. Try each one and watch the door.',
          'One switch opens the door. The other does nothing to it.',
          'Switch on the orange circle, then walk through the door.',
        ],
      },
    ],
  },
  {
    id: 'ch2',
    name: 'The Unknown',
    blurb: 'Switches, plates and things you can push. Some rules only apply sometimes.',
    levels: [
      {
        levelId: 'w03-locked-garden',
        hints: [
          'Something here can hold a plate down while you walk away.',
          'Push the purple block onto the plate. Interact drags it back if you get it wrong.',
          'Push the block right twice onto the plate, then take the open door.',
        ],
      },
      {
        levelId: 'w04-only-when',
        hints: [
          'A switch that does nothing is telling you something.',
          'The triangle only works while the circle is off. The square undoes the door.',
          'Switch the circle off, switch the triangle on, and leave the square alone.',
        ],
      },
    ],
  },
  {
    id: 'ch4',
    name: 'Adaptation',
    blurb: 'What you learned may stop being true.',
    levels: [
      {
        levelId: 'w05-garden-shifts',
        hints: [
          'Two doors, but one is sealed. What does the glowing rune do?',
          'Stepping on the rune changes the rules. Then try the other switch.',
          'Open the gate, step on the rune, switch on the blue diamond, then take the far door.',
        ],
      },
    ],
  },
];

/** Campaign order: chapters in order, levels in order. */
export const CAMPAIGN_ORDER: readonly string[] = CAMPAIGN.flatMap((c) => c.levels.map((l) => l.levelId));

export const levelById = (id: string): ChallengeDefinition | undefined => LEVELS.find((l) => l.id === id);

export function campaignEntry(id: string): { chapter: Chapter; entry: CampaignLevel; indexInCampaign: number } | undefined {
  for (const chapter of CAMPAIGN) {
    const entry = chapter.levels.find((l) => l.levelId === id);
    if (entry) return { chapter, entry, indexInCampaign: CAMPAIGN_ORDER.indexOf(id) };
  }
  return undefined;
}

export const nextLevelId = (id: string): string | null => CAMPAIGN_ORDER[CAMPAIGN_ORDER.indexOf(id) + 1] ?? null;
