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
 * Chapter placement is metadata: level ids stay stable. Five chapters of four worlds each; every world passes
 * the solver gates (solvable, within budget, no dead states, replay-verified) before it is listed.
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
      {
        levelId: 'w06-both-needed',
        hints: [
          'A switch at each end of the corridor, and one in the middle. Try them and watch the door.',
          'The door opens only when both end switches are on. The middle one does nothing.',
          'Switch on the left end, walk to the right end and switch that on, then take the door.',
        ],
      },
      {
        levelId: 'w07-off-is-on',
        hints: [
          'Both switches already glow, yet the door is shut. Maybe lit is not what it wants.',
          'The door cares how many switches are lit, not which ones. Try the combinations.',
          'Walk right and switch one of them off (the yellow square works), then take the door.',
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
      {
        levelId: 'w11-corner-piece',
        hints: [
          'The plate sits in a niche below the room. The block has to arrive from above.',
          'Push the block along the top row, then climb over it and push it down.',
          'Push the block right until it is above the plate, go around over the top, push it down, then return left and take the door.',
        ],
      },
      {
        levelId: 'w09-hold-the-line',
        hints: [
          'The switch does nothing when you try it. Something has to be true first.',
          'The switch only responds while the pressure plate is held down. Use the block.',
          'Push the block right onto the plate, go around to the switch and flip it, then take the door.',
        ],
      },
    ],
  },
  {
    id: 'ch3',
    name: 'The Strategist',
    blurb: 'Plan before you move. Budgets tighten and order matters.',
    levels: [
      {
        levelId: 'w10-in-order',
        hints: [
          'Two of these switches refuse to move at first. Notice which, and what changes once you succeed.',
          'Each stubborn switch wakes up when the one before it is on. The door dislikes the first switch being left on.',
          'Switch on the first, then the second, then turn the first off again. Walk right, switch on the third, and take the door.',
        ],
      },
      {
        levelId: 'w08-heavy-load',
        hints: [
          'Two plates, two blocks, and a door that will not open for you yet. Start with what you can reach.',
          'The first plate opens the gate to the lower room, and both plates must be held at the end. Leave the first block where it is.',
          'Push the upper block onto its plate, go through the gate, push the lower block left onto its plate, then take the exit door.',
        ],
      },
      {
        levelId: 'w12-against-the-wall',
        hints: [
          'The block is stuck in the corner. Pushing it from this side will not help.',
          'Interact pulls a block toward you as you step back. Pull it onto the plate.',
          'Go around to the left of the block, pull it three times so it lands on the plate, then walk back and take the door.',
        ],
      },
      {
        levelId: 'w13-combination',
        hints: [
          'Try the switches one at a time and watch the door. Not all four matter.',
          'The door wants the first switch on, the fourth off, and at least one of the middle two on.',
          'Switch the first on, one of the middle two on and the fourth off, then take the door.',
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
      {
        levelId: 'w14-reversal',
        hints: [
          'The door is open. Walking toward it is not as safe as it looks.',
          'The rune reverses the door\'s rule: afterwards it opens when the switch is off.',
          'Switch the first switch off, cross the rune, and walk to the exit.',
        ],
      },
      {
        levelId: 'w15-swapped-wires',
        hints: [
          'After the rune, check what each switch does again.',
          'The rune swaps which switch opens which door.',
          'Switch on the second switch, cross the rune, and walk through both doors. The first switch is already on.',
        ],
      },
      {
        levelId: 'w16-the-simple-way',
        hints: [
          'Look closely at everything in the room before you commit to the obvious puzzle.',
          'The rune changes the door\'s rule. Afterwards it opens when the plate is not pressed.',
          'Skip the block. Step on the rune, then walk back around to the door.',
        ],
      },
    ],
  },
  {
    id: 'ch5',
    name: 'The Frontier',
    blurb: 'Everything at once, and some things do not wait for you.',
    levels: [
      {
        levelId: 'w17-spring-loaded',
        hints: [
          'Watch the switch after you use it.',
          'The switch turns itself back off after a few moves, and the door closes with it. Be quick.',
          'Step right once, flip the switch below you, then run right and down to the door without stopping.',
        ],
      },
      {
        levelId: 'w18-two-springs',
        hints: [
          'Both switches fade. Find out which one fades faster.',
          'The right switch fades faster than the left, so do the longer-lasting one first.',
          'Flip the left switch, run to the right switch and flip it, then go straight back to the door.',
        ],
      },
      {
        levelId: 'w19-two-of-three',
        hints: [
          'Try the switches one at a time, then in pairs. Watch the door, and watch how long each one stays lit.',
          'The door opens when any two of the three are lit at once. The bottom switch lasts longest, so use it first.',
          'Flip the bottom switch, then walk to the left or right switch and flip it, then go straight up to the door.',
        ],
      },
      {
        levelId: 'w20-the-last-experiment',
        hints: [
          'The exit is sealed. Look for what changes the world, and for what the plate and the switch are for.',
          'Three things must be true at once: the plate held down, the rune stepped on, and the fading switch lit. Do the fading one last.',
          'Block onto the plate, step on the rune, then flip the switch and run straight to the exit door.',
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
