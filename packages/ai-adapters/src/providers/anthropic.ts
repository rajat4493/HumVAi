import type { CallUsage, DecisionRequest, DecisionResponse, ModelAdapter, ModelIdentity, SamplingConfig } from '../types';
import { AdapterError } from '../types';
import { defaultHttp, httpJson } from './http';
import type { HttpOptions } from './http';

export interface AnthropicOptions {
  apiKey: string;
  modelId: string;
  displayName?: string;
  baseUrl?: string;
  sampling?: SamplingConfig;
  /** The Messages API requires max_tokens; default is generous so replies are never cut short by us. */
  maxTokens?: number;
  http?: (timeoutMs: number, signal?: AbortSignal) => HttpOptions;
}

const API_VERSION = '2023-06-01';

export function anthropicAdapter(o: AnthropicOptions): ModelAdapter {
  const base = (o.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
  const identity: ModelIdentity = { provider: 'anthropic', modelId: o.modelId, displayName: o.displayName ?? o.modelId };
  const maxTokens = o.sampling?.maxOutputTokens ?? o.maxTokens ?? 16_000;
  const sampling: SamplingConfig = { reasoning: { mode: 'default' }, ...o.sampling, maxOutputTokens: maxTokens };
  const http = o.http ?? defaultHttp;
  return {
    identity,
    sampling,
    async decide(req: DecisionRequest, signal?: AbortSignal): Promise<DecisionResponse> {
      const body: Record<string, unknown> = {
        model: o.modelId,
        max_tokens: maxTokens,
        system: req.system,
        messages: req.messages,
      };
      if (sampling.temperature !== undefined) body.temperature = sampling.temperature;
      if (sampling.topP !== undefined) body.top_p = sampling.topP;
      const r = await httpJson(
        `${base}/v1/messages`,
        { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': o.apiKey, 'anthropic-version': API_VERSION }, body: JSON.stringify(body) },
        http(req.limits.timeoutMs, signal),
      );
      const content = Array.isArray(r.json.content) ? (r.json.content as { type?: string; text?: string }[]) : [];
      const raw = content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      const u = (r.json.usage ?? {}) as Record<string, number | undefined>;
      const cacheRead = u.cache_read_input_tokens ?? 0;
      const usage: CallUsage = {
        // The API reports cache reads/writes separately from input_tokens; normalise to "all input tokens".
        inputTokens: (u.input_tokens ?? 0) + cacheRead + (u.cache_creation_input_tokens ?? 0),
        outputTokens: u.output_tokens ?? 0,
        cachedInputTokens: u.cache_read_input_tokens === undefined ? null : cacheRead,
        reasoningTokens: null,
      };
      if (typeof r.json.type === 'string' && r.json.type === 'error') throw new AdapterError('provider', 'provider returned an error object');
      return {
        raw,
        usage,
        latencyMs: Math.round(r.latencyMs),
        providerRequestId: r.headers.get('request-id') ?? (typeof r.json.id === 'string' ? r.json.id : null),
        finishReason: typeof r.json.stop_reason === 'string' ? r.json.stop_reason : 'other',
        respondedModel: typeof r.json.model === 'string' ? r.json.model : null,
        retries: r.retries,
      };
    },
  };
}

/** Lists model ids the key can use; used by preflight so we never guess an identifier. */
export async function listAnthropicModels(apiKey: string, baseUrl = 'https://api.anthropic.com'): Promise<string[]> {
  const r = await httpJson(
    `${baseUrl.replace(/\/$/, '')}/v1/models?limit=1000`,
    { method: 'GET', headers: { 'x-api-key': apiKey, 'anthropic-version': API_VERSION } },
    { timeoutMs: 30_000, maxRetries: 2, backoffMs: (n) => 500 * n },
  );
  const data = Array.isArray(r.json.data) ? (r.json.data as { id?: string }[]) : [];
  return data.map((m) => m.id ?? '').filter(Boolean);
}
