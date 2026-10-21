import type { ChallengeDefinition } from '@hva/game-core';
import { solve } from '@hva/game-core';

const cache = new Map<string, number>();

/** Shortest possible run for a world (computed once; the worlds are tiny). */
export function optimalLength(level: ChallengeDefinition): number {
  const key = `${level.id}@${level.version}`;
  let v = cache.get(key);
  if (v === undefined) {
    v = solve(level).optimalLength ?? level.budget.execute;
    cache.set(key, v);
  }
  return v;
}
