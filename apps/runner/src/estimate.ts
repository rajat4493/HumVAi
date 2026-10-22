import type { ChallengeDefinition, GameAction, GameEvent } from '@hva/game-core';
import { create, legalActions, observe, solve, step } from '@hva/game-core';
import { SYSTEM_PROMPT, buildMessages, buildTurnMessage, DEFAULT_LIMITS, costOf } from '@hva/ai-adapters';
import type { PriceEntry, Turn } from '@hva/ai-adapters';

/** Conservative: real tokenizers give roughly 3.5-4 characters per token on this kind of text. Using 3 overstates cost, never understates it. */
export const CHARS_PER_TOKEN = 3;
const tokens = (chars: number): number => Math.ceil(chars / CHARS_PER_TOKEN);

export interface AttemptEstimate {
  levelId: string;
  /** Calls a perfect player needs (scout commit + optimal run). */
  likelyCalls: number;
  /** The hard ceiling the runner enforces before it voids the attempt. */
  maxCalls: number;
  likelyInputTokens: number;
  worstInputTokens: number;
  likelyOutputTokens: number;
  worstOutputTokens: number;
}

const reply = (a: GameAction): string => JSON.stringify({ action: a });

/**
 * Upper and "if all goes well" token use of one attempt, from the real prompt and a real optimal playthrough.
 * Every call re-sends the whole history, so input grows with the square of the number of calls: this is the number
 * that matters for cost. `outputPerCall` is an assumption (the model's reply plus any hidden reasoning); `maxOutputTokens`
 * is the per-call ceiling used for the worst case.
 */
export function estimateAttempt(level: ChallengeDefinition, opts: { outputPerCall: number; maxOutputTokens: number }): AttemptEstimate {
  const plan: GameAction[] = [...(level.budget.explore > 0 ? [{ type: 'COMMIT' } as GameAction] : []), ...((solve(level).optimalSolution ?? []) as GameAction[])];
  const state = create(level, 'estimate');
  const history: Turn[] = [];
  const userSizes: number[] = [];
  let lastEvents: GameEvent[] | null = null;
  let likelyInput = 0;
  for (const a of plan) {
    const user = buildTurnMessage({ briefing: level.briefing, observation: observe(state), lastEvents, legalActions: legalActions(state), rejection: null });
    history.push({ user });
    userSizes.push(user.length);
    likelyInput += tokens(SYSTEM_PROMPT.length + buildMessages(history).reduce((n, m) => n + m.content.length, 0));
    (history[history.length - 1] as Turn).assistant = reply(a);
    lastEvents = step(state, a).events;
  }
  const maxCalls = level.budget.explore + level.budget.execute + DEFAULT_LIMITS.maxRejected + DEFAULT_LIMITS.extraCalls;
  // worst case: every one of maxCalls turns is as large as the largest observed turn
  const biggest = Math.max(...userSizes);
  const perTurnChars = biggest + reply({ type: 'MOVE', direction: 'RIGHT' }).length;
  let worstInput = 0;
  for (let n = 1; n <= maxCalls; n++) worstInput += tokens(SYSTEM_PROMPT.length + n * perTurnChars);
  return {
    levelId: level.id,
    likelyCalls: plan.length,
    maxCalls,
    likelyInputTokens: likelyInput,
    worstInputTokens: worstInput,
    likelyOutputTokens: plan.length * opts.outputPerCall,
    worstOutputTokens: maxCalls * opts.maxOutputTokens,
  };
}

export function estimateUsd(e: AttemptEstimate, price: PriceEntry, attempts: number): { likely: number; worst: number } {
  const c = (input: number, output: number) => (costOf(price, { inputTokens: input, outputTokens: output, cachedInputTokens: 0 }) as number) * attempts;
  return { likely: c(e.likelyInputTokens, e.likelyOutputTokens), worst: c(e.worstInputTokens, e.worstOutputTokens) };
}
