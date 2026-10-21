export interface Side {
  won: boolean;
  runActions: number;
  scoutActions: number;
}

export type Outcome = 'HUMAN_AHEAD' | 'AI_AHEAD' | 'TIE' | 'BOTH_FAILED' | 'INCONCLUSIVE' | 'ASSISTED';

export interface Comparison {
  outcome: Outcome;
  /** Which row settled it; 'none' for ties, both-failed, inconclusive and assisted. */
  decidedBy: 'outcome' | 'run' | 'scout' | 'none';
}

/**
 * Head-to-head against ONE recorded attempt (docs/ai/experiment-spec.md section 12), written down before any data existed:
 *  1. Reaching the exit beats not reaching it.
 *  2. Both reached it: fewer run actions wins.
 *  3. Equal run actions: fewer scout actions wins.
 *  4. Equal on all three: tie. Neither reached it: both failed (never a tie).
 * No verified AI record -> inconclusive (never an automatic human win). A hinted human run is not compared:
 * it still completes the world, but the verdict is withheld (hint scoring rule).
 */
export function compareHeadToHead(human: Side, ai: Side | null, opts: { humanAssisted?: boolean } = {}): Comparison {
  if (ai === null) return { outcome: 'INCONCLUSIVE', decidedBy: 'none' };
  if (opts.humanAssisted) return { outcome: 'ASSISTED', decidedBy: 'none' };
  if (human.won !== ai.won) return { outcome: human.won ? 'HUMAN_AHEAD' : 'AI_AHEAD', decidedBy: 'outcome' };
  if (!human.won) return { outcome: 'BOTH_FAILED', decidedBy: 'none' };
  if (human.runActions !== ai.runActions) return { outcome: human.runActions < ai.runActions ? 'HUMAN_AHEAD' : 'AI_AHEAD', decidedBy: 'run' };
  if (human.scoutActions !== ai.scoutActions) return { outcome: human.scoutActions < ai.scoutActions ? 'HUMAN_AHEAD' : 'AI_AHEAD', decidedBy: 'scout' };
  return { outcome: 'TIE', decidedBy: 'none' };
}
