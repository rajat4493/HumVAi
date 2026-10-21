import { create, legalActions, stepInternal, worldKey } from './engine';
import type { ChallengeDefinition, GameAction, GameState } from './types';

export interface SolveOptions {
  maxStates?: number;
  /** Prune every state where the world has changed epoch (answers: "can it be won while ignoring the rule change?"). */
  stayInEpoch0?: boolean;
}

export interface SolveResult {
  solvable: boolean;
  /** Fewest run actions to win (RESET excluded: a reset never shortens a solution). */
  optimalLength: number | null;
  optimalSolution: GameAction[] | null;
  /** Number of distinct shortest action sequences. */
  optimalSolutionCount: number;
  /** Win reachable within the declared run budget? */
  withinBudget: boolean;
  /** Reachable non-winning world states (budget ignored). */
  reachableStates: number;
  /** Reachable states from which no win exists at all; only RESET escapes them. */
  deadStates: number;
  /** Reachable states that can never return to the start without RESET (superset of dead). */
  irreversibleStates: number;
  /** Same counts restricted to states reachable within the run budget. */
  reachableWithinBudget: number;
  deadWithinBudget: number;
  irreversibleWithinBudget: number;
}

type Node = { state: GameState; depth: number; ways: number; parent: string | null; via: GameAction | null };

/**
 * Exhaustive breadth-first search over world states using the real transition function,
 * so "solvable" means "solvable by legal play", not "solvable by a separate model".
 * The run phase is analysed in isolation (scouting only lets a participant learn the rules).
 */
export function solve(challenge: ChallengeDefinition, opts: SolveOptions = {}): SolveResult {
  const maxStates = opts.maxStates ?? 500_000;
  const runOnly: ChallengeDefinition = { ...challenge, budget: { explore: 0, execute: Number.MAX_SAFE_INTEGER } };
  const root = create(runOnly, 'solver');
  const rootKey = worldKey(root);

  const nodes = new Map<string, Node>([[rootKey, { state: root, depth: 0, ways: 1, parent: null, via: null }]]);
  const edges = new Map<string, string[]>();
  const wins = new Set<string>();
  let frontier = [rootKey];

  while (frontier.length > 0 && nodes.size < maxStates) {
    const nextFrontier: string[] = [];
    for (const key of frontier) {
      const node = nodes.get(key) as Node;
      const kids: string[] = [];
      for (const action of legalActions(node.state)) {
        if (action.type === 'RESET' || action.type === 'COMMIT') continue;
        const { next } = stepInternal(node.state, action);
        if (opts.stayInEpoch0 && next.epoch > 0) continue;
        const nk = worldKey(next);
        kids.push(nk);
        const known = nodes.get(nk);
        if (!known) {
          nodes.set(nk, { state: next, depth: node.depth + 1, ways: node.ways, parent: key, via: action });
          if (next.status === 'won') wins.add(nk);
          else nextFrontier.push(nk);
        } else if (known.depth === node.depth + 1) {
          known.ways += node.ways;
        }
      }
      edges.set(key, kids);
    }
    frontier = nextFrontier;
  }

  // Shortest win and one witness path.
  let best: Node | undefined;
  let bestKey: string | null = null;
  for (const k of wins) {
    const n = nodes.get(k) as Node;
    if (!best || n.depth < best.depth) {
      best = n;
      bestKey = k;
    }
  }
  const optimalLength = best ? best.depth : null;
  const optimalWays = best && optimalLength !== null
    ? [...wins].filter((k) => (nodes.get(k) as Node).depth === optimalLength).reduce((a, k) => a + (nodes.get(k) as Node).ways, 0)
    : 0;
  const optimalSolution: GameAction[] | null = best ? [] : null;
  let cur: Node | undefined = bestKey ? nodes.get(bestKey) : undefined;
  while (cur && cur.parent !== null && cur.via) {
    optimalSolution?.unshift(cur.via);
    cur = nodes.get(cur.parent);
  }

  // Dead = cannot reach any win. Irreversible = cannot reach the start again (without RESET).
  const reverse = new Map<string, string[]>();
  for (const [from, tos] of edges) for (const to of tos) (reverse.get(to) ?? reverse.set(to, []).get(to) as string[]).push(from);
  const closure = (seeds: Iterable<string>): Set<string> => {
    const seen = new Set<string>(seeds);
    const stack = [...seen];
    while (stack.length > 0) {
      for (const p of reverse.get(stack.pop() as string) ?? []) {
        if (seen.has(p)) continue;
        seen.add(p);
        stack.push(p);
      }
    }
    return seen;
  };
  const canWin = closure(wins);
  const canReturn = closure([rootKey]);

  const budget = challenge.budget.execute;
  let reachable = 0, dead = 0, irreversible = 0, reachableB = 0, deadB = 0, irreversibleB = 0;
  for (const [k, n] of nodes) {
    if (wins.has(k)) continue;
    const isDead = !canWin.has(k);
    const isIrr = !canReturn.has(k);
    reachable++;
    if (isDead) dead++;
    if (isIrr) irreversible++;
    if (n.depth <= budget) {
      reachableB++;
      if (isDead) deadB++;
      if (isIrr) irreversibleB++;
    }
  }

  return {
    solvable: optimalLength !== null,
    optimalLength,
    optimalSolution,
    optimalSolutionCount: optimalWays,
    withinBudget: optimalLength !== null && optimalLength <= budget,
    reachableStates: reachable,
    deadStates: dead,
    irreversibleStates: irreversible,
    reachableWithinBudget: reachableB,
    deadWithinBudget: deadB,
    irreversibleWithinBudget: irreversibleB,
  };
}
