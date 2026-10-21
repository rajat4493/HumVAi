import type { GameAction } from '@hva/game-core';
import type { CallUsage, DecisionRequest, DecisionResponse, ModelAdapter } from './types';

const zero: CallUsage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: null, reasoningTokens: null };

function response(raw: string): DecisionResponse {
  return { raw, usage: zero, latencyMs: 0, providerRequestId: null, finishReason: 'stop', respondedModel: null, retries: 0 };
}

/**
 * A test adapter that plays a fixed action list. It is never a model and is always labelled as a
 * reference/test player ("Reference solver (not an AI)") wherever its records could be shown.
 */
export function scriptedAdapter(actions: GameAction[], opts: { afterEnd?: 'garbage' | 'reset' } = {}): ModelAdapter {
  let n = 0;
  return {
    identity: { provider: 'test', modelId: 'scripted', displayName: 'Reference solver (not an AI)' },
    sampling: {},
    async decide(): Promise<DecisionResponse> {
      const a = actions[n++];
      if (a) return response(JSON.stringify({ action: a }));
      return response(opts.afterEnd === 'reset' ? JSON.stringify({ action: { type: 'RESET' } }) : 'I am not sure what to do.');
    },
  };
}

/** Test adapter that returns arbitrary text per call (for malformed-reply tests). */
export function textAdapter(replies: string[]): ModelAdapter {
  let n = 0;
  return {
    identity: { provider: 'test', modelId: 'text', displayName: 'Reference solver (not an AI)' },
    sampling: {},
    async decide(_req: DecisionRequest): Promise<DecisionResponse> {
      return response(replies[Math.min(n++, replies.length - 1)] ?? '');
    },
  };
}

/** Picks a uniformly random legal action using the LEGAL ACTIONS section of the prompt (deterministic per seed). */
export function randomLegalAdapter(seed: number): ModelAdapter {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return {
    identity: { provider: 'test', modelId: 'random-legal', displayName: 'Reference solver (not an AI)' },
    sampling: {},
    async decide(req: DecisionRequest): Promise<DecisionResponse> {
      const last = req.messages[req.messages.length - 1]?.content ?? '';
      const m = /LEGAL ACTIONS\n(\[.*\])/.exec(last);
      const legal = (m ? JSON.parse(m[1] as string) : []) as GameAction[];
      const pick = legal[Math.floor(next() * legal.length)];
      return response(JSON.stringify({ action: pick ?? { type: 'RESET' } }));
    },
  };
}
