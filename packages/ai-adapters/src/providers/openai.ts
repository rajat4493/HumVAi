import type { CallUsage, DecisionRequest, DecisionResponse, ModelAdapter, ModelIdentity, SamplingConfig } from '../types';
import { defaultHttp, httpJson } from './http';
import type { HttpOptions } from './http';

export interface OpenAIOptions {
  apiKey: string;
  modelId: string;
  displayName?: string;
  baseUrl?: string;
  /** 'chat' = /v1/chat/completions, 'responses' = /v1/responses. Which one a model needs is not guessed here. */
  api?: 'chat' | 'responses';
  sampling?: SamplingConfig;
  http?: (timeoutMs: number, signal?: AbortSignal) => HttpOptions;
}

type N = Record<string, number | undefined>;

export function openaiAdapter(o: OpenAIOptions): ModelAdapter {
  const base = (o.baseUrl ?? 'https://api.openai.com').replace(/\/$/, '');
  const api = o.api ?? 'chat';
  const identity: ModelIdentity = { provider: 'openai', modelId: o.modelId, displayName: o.displayName ?? o.modelId };
  // No temperature is sent unless configured: several current models only accept their default.
  const sampling: SamplingConfig = { reasoning: { mode: 'default' }, extra: { api }, ...o.sampling };
  const http = o.http ?? defaultHttp;
  return {
    identity,
    sampling,
    async decide(req: DecisionRequest, signal?: AbortSignal): Promise<DecisionResponse> {
      const headers = { 'content-type': 'application/json', authorization: `Bearer ${o.apiKey}` };
      const cap = sampling.maxOutputTokens;
      let body: Record<string, unknown>;
      let url: string;
      if (api === 'chat') {
        url = `${base}/v1/chat/completions`;
        body = { model: o.modelId, messages: [{ role: 'system', content: req.system }, ...req.messages] };
        if (cap) body.max_completion_tokens = cap;
      } else {
        url = `${base}/v1/responses`;
        body = { model: o.modelId, instructions: req.system, input: req.messages };
        if (cap) body.max_output_tokens = cap;
      }
      if (sampling.temperature !== undefined) body.temperature = sampling.temperature;
      if (sampling.topP !== undefined) body.top_p = sampling.topP;
      const r = await httpJson(url, { method: 'POST', headers, body: JSON.stringify(body) }, http(req.limits.timeoutMs, signal));

      let raw = '';
      let usage: CallUsage;
      let finish = 'other';
      if (api === 'chat') {
        const choice = (Array.isArray(r.json.choices) ? r.json.choices[0] : undefined) as { message?: { content?: string | null }; finish_reason?: string } | undefined;
        raw = choice?.message?.content ?? '';
        finish = choice?.finish_reason ?? 'other';
        const u = (r.json.usage ?? {}) as N & { prompt_tokens_details?: N; completion_tokens_details?: N };
        usage = {
          inputTokens: u.prompt_tokens ?? 0,
          outputTokens: u.completion_tokens ?? 0,
          cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? null,
          reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? null,
        };
      } else {
        const out = Array.isArray(r.json.output) ? (r.json.output as { type?: string; content?: { type?: string; text?: string }[] }[]) : [];
        raw = out
          .filter((i) => i.type === 'message')
          .flatMap((i) => i.content ?? [])
          .filter((c) => c.type === 'output_text')
          .map((c) => c.text ?? '')
          .join('');
        finish = typeof r.json.status === 'string' ? r.json.status : 'other';
        const u = (r.json.usage ?? {}) as N & { input_tokens_details?: N; output_tokens_details?: N };
        usage = {
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          cachedInputTokens: u.input_tokens_details?.cached_tokens ?? null,
          reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? null,
        };
      }
      return {
        raw,
        usage,
        latencyMs: Math.round(r.latencyMs),
        providerRequestId: r.headers.get('x-request-id') ?? (typeof r.json.id === 'string' ? r.json.id : null),
        finishReason: finish,
        respondedModel: typeof r.json.model === 'string' ? r.json.model : null,
        retries: r.retries,
      };
    },
  };
}

export async function listOpenAIModels(apiKey: string, baseUrl = 'https://api.openai.com'): Promise<string[]> {
  const r = await httpJson(
    `${baseUrl.replace(/\/$/, '')}/v1/models`,
    { method: 'GET', headers: { authorization: `Bearer ${apiKey}` } },
    { timeoutMs: 30_000, maxRetries: 2, backoffMs: (n) => 500 * n },
  );
  const data = Array.isArray(r.json.data) ? (r.json.data as { id?: string }[]) : [];
  return data.map((m) => m.id ?? '').filter(Boolean);
}
