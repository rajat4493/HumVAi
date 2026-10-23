import { CAMPAIGN_ORDER } from '@hva/game-core';
import { phProgress } from '../games/pattern-hunter/storage';
import { completedCount } from '../save/save';
import { store } from '../save/instance';
import type { GameModule } from './contract';

/**
 * The catalogue. Adding a game is adding an entry here (and a folder under games/). Order is display order.
 * Entries without `load` are catalogue cards only: no Play button is ever drawn for them.
 */
export const GAMES: readonly GameModule[] = [
  {
    id: 'experiment',
    name: 'The Experiment',
    tagline: 'Twenty strange worlds with hidden rules. Scout, then run. Work out what nobody told you.',
    status: 'available',
    load: () => import('../games/experiment/ExperimentGame').then((m) => ({ default: m.ExperimentGame })),
    progress: () => {
      const n = completedCount(store.get());
      return { label: `${n} of ${CAMPAIGN_ORDER.length} worlds finished`, started: n > 0, fraction: n / CAMPAIGN_ORDER.length };
    },
    // Flipped on by data, not by hand, once verified recordings are published: see Home (it checks the manifest).
    capabilities: { verifiedAiRecordings: false },
  },
  {
    id: 'pattern-hunter',
    name: 'Pattern Hunter',
    tagline: 'Find the hidden rule from a few examples and a few experiments.',
    status: 'experimental',
    load: () => import('../games/pattern-hunter/PatternHunterGame').then((m) => ({ default: m.PatternHunterGame })),
    progress: phProgress,
  },
  {
    id: 'detective',
    name: 'The Detective',
    tagline: 'Weigh the evidence, solve the mystery, change your mind when you should.',
    status: 'coming-soon',
  },
];

export const gameById = (id: string | null): GameModule | undefined => GAMES.find((g) => g.id === id);
