import { create, legalActions, stepInternal, worldKey } from './engine';
import type { ChallengeDefinition, GameAction } from './types';

export interface SolveResult {
  solvable: boolean;
  /** Fewest actions to win (RESET excluded: a reset never shortens a solution). */
  optimalLength: number | null;
  optimalSolution: GameAction[] | null;
  /** Number of distinct shortest action sequences. */
  optimalSolutionCount: number;
  /** Win reachable within the declared budget? */
  withinBudget: boolean;
  statesExplored: number;
  /** Distinct reachable states from which no win is possible (excluding the budget). */
  deadStates: number;
  reachableStates: number;
}

/**
 * Breadth-first search over world states using the real engine transition function,
 * so "solvable" means "solvable by legal play", not "solvable by a separate model".
 */
export function solve(challenge: ChallengeDefinition, maxStates = 500_000): SolveResult {
  const start = create(challenge, 'solver');
  // Budget is deliberately ignored so we can measure the true optimum and dead ends separately.
  const unbounded = { ...challenge, budget: Number.MAX_SAFE_INTEGER };
  const root = create(unbounded, 'solver');

  type Node = { state: typeof root; depth: number; ways: number; parent: string | null; via: GameAction | null };
  const nodes = new Map<string, Node>();
  const edges = new Map<string, string[]>();
  const rootKey = worldKey(root);
  nodes.set(rootKey, { state: root, depth: 0, ways: 1, parent: null, via: null });
  let frontier = [rootKey];
  let winKey: string | null = null;
  let winDepth = Infinity;
  let winWays = 0;

  while (frontier.length > 0 && nodes.size < maxStates) {
    const nextFrontier: string[] = [];
    for (const key of frontier) {
      const node = nodes.get(key) as Node;
      if (node.depth >= winDepth) continue;
      const kids: string[] = [];
      for (const action of legalActions(node.state)) {
        if (action.type === 'RESET') continue;
        const { next } = stepInternal(node.state, action);
        const nk = worldKey(next);
        kids.push(nk);
        const known = nodes.get(nk);
        if (!known) {
          nodes.set(nk, { state: next, depth: node.depth + 1, ways: node.ways, parent: key, via: action });
          nextFrontier.push(nk);
        } else if (known.depth === node.depth + 1) {
          known.ways += node.ways;
        }
        if (next.status === 'won') {
          if (node.depth + 1 < winDepth) {
            winDepth = node.depth + 1;
            winKey = nk;
          }
        }
      }
      edges.set(key, kids);
    }
    frontier = nextFrontier;
  }

  let winNode: Node | undefined = winKey ? nodes.get(winKey) : undefined;
  if (winNode) winWays = winNode.ways;

  const optimalSolution: GameAction[] | null = winNode ? [] : null;
  while (winNode && winNode.parent !== null && winNode.via) {
    optimalSolution?.unshift(winNode.via);
    winNode = nodes.get(winNode.parent) as Node;
  }

  // Dead-state analysis: explore the full reachable graph (budget-free) and mark states that can reach a win.
  const full = fullGraph(unbounded, maxStates);
  const canWin = new Set<string>(full.wins);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, kids] of full.edges) {
      if (!canWin.has(k) && kids.some((c) => canWin.has(c))) {
        canWin.add(k);
        changed = true;
      }
    }
  }
  const nonTerminal = [...full.edges.keys()].filter((k) => !full.wins.has(k));
  const dead = nonTerminal.filter((k) => !canWin.has(k)).length;

  const optimalLength = winKey ? winDepth : null;
  void start;
  return {
    solvable: optimalLength !== null,
    optimalLength,
    optimalSolution,
    optimalSolutionCount: winWays,
    withinBudget: optimalLength !== null && optimalLength <= challenge.budget,
    statesExplored: nodes.size,
    deadStates: dead,
    reachableStates: full.edges.size + full.wins.size,
  };
}

function fullGraph(challenge: ChallengeDefinition, maxStates: number) {
  const root = create(challenge, 'solver');
  const seen = new Map<string, typeof root>([[worldKey(root), root]]);
  const edges = new Map<string, string[]>();
  const wins = new Set<string>();
  const queue = [worldKey(root)];
  while (queue.length > 0 && seen.size < maxStates) {
    const key = queue.pop() as string;
    const state = seen.get(key) as typeof root;
    const kids: string[] = [];
    for (const action of legalActions(state)) {
      if (action.type === 'RESET') continue;
      const { next } = stepInternal(state, action);
      const nk = worldKey(next);
      kids.push(nk);
      if (next.status === 'won') wins.add(nk);
      else if (!seen.has(nk)) {
        seen.set(nk, next);
        queue.push(nk);
      }
    }
    edges.set(key, kids);
  }
  return { edges, wins };
}
