import type { Outcome } from '@hva/ai-adapters';

export interface ShareInput {
  worldName: string;
  human: { won: boolean; runActions: number; optimal: number; assisted: boolean };
  /** Null when there is no verified recording to compare with. */
  ai: { label: string; kind: 'model' | 'reference'; won: boolean; runActions: number; attemptsWon: number; attemptsTotal: number } | null;
  outcome: Outcome;
}

const VERDICT: Record<Outcome, string> = {
  HUMAN_AHEAD: 'I got there first.',
  AI_AHEAD: 'The AI got there faster.',
  TIE: 'Dead even.',
  BOTH_FAILED: 'Neither made it out.',
  INCONCLUSIVE: 'No AI comparison this time.',
  ASSISTED: 'Played with hints, so no verdict.',
};

/** Spoiler-free summary for sharing. Any AI result is always described as a recorded attempt, never as live. */
export function shareText(i: ShareInput): string {
  const lines = [`Humans vs AI · The Experiment · ${i.worldName}`];
  lines.push(i.human.won ? `I reached the exit in ${i.human.runActions} actions (shortest possible: ${i.human.optimal})${i.human.assisted ? ', with hints' : ''}.` : 'I ran out of actions this time.');
  if (i.ai) {
    const who = i.ai.kind === 'reference' ? `A recorded reference player (${i.ai.label})` : `The AI's recorded attempt (${i.ai.label})`;
    lines.push(i.ai.won ? `${who} reached the exit in ${i.ai.runActions} actions.` : `${who} did not reach the exit. It was one of ${i.ai.attemptsTotal} recorded attempts; ${i.ai.attemptsWon} reached the exit.`);
  }
  lines.push(VERDICT[i.outcome]);
  return lines.join('\n');
}
