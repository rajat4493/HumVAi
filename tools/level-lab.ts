// Level authoring lab: prints the solver gates for a level module.
//   npx tsx tools/level-lab.ts path/to/levelNN.ts [exportName]
// Gates reported: solvable, optimal and number of optimal lines, reachable/dead/irreversible states,
// budget ratios, whether a rule change is essential, and one optimal solution.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { solve } from '@hva/game-core';
import type { ChallengeDefinition, GameAction } from '@hva/game-core';

const [, , file, name] = process.argv;
if (!file) throw new Error('usage: tsx tools/level-lab.ts <file> [exportName]');
const mod = (await import(pathToFileURL(resolve(file)).href)) as Record<string, ChallengeDefinition>;
const level = (name ? mod[name] : Object.values(mod).find((v) => v && typeof v === 'object' && 'map' in v)) as ChallengeDefinition;
const r = solve(level, { maxStates: 2_000_000 });
const ignoring = level.rules.shift ? solve(level, { stayInEpoch0: true, maxStates: 2_000_000 }) : null;
const fmt = (a: GameAction) => (a.type === 'MOVE' ? a.direction[0] : a.type === 'INTERACT' ? `[${a.targetId}]` : a.type);
console.log(level.map.join('\n'));
console.log(
  JSON.stringify(
    {
      id: level.id,
      budget: level.budget,
      optimal: r.optimalLength,
      optimalLines: r.optimalSolutionCount,
      reachable: r.reachableStates,
      dead: r.deadStates,
      irreversible: r.irreversibleStates,
      runSlack: r.optimalLength === null ? null : level.budget.execute - r.optimalLength,
      runRatio: r.optimalLength === null ? null : +(level.budget.execute / r.optimalLength).toFixed(2),
      scoutVsOptimal: r.optimalLength === null ? null : +(level.budget.explore / r.optimalLength).toFixed(2),
      shiftEssential: ignoring ? !ignoring.solvable : null,
    },
    null,
    1,
  ),
);
console.log((r.optimalSolution ?? []).map(fmt).join(' '));
