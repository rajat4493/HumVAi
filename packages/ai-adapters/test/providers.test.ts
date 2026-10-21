import { afterEach, describe, expect, it } from 'vitest';
import { AdapterError, runAttempt, verifyRecord } from '../src';
import type { DecisionRequest } from '../src';
import { anthropicAdapter, listAnthropicModels, listOpenAIModels, openaiAdapter } from '../src/providers';
import { level, mockServer, noWait, planFor } from './helpers';

const KEY = 'sk-test-SENTINEL-1234567890';
const req: DecisionRequest = {
  schemaVersion: 'hva.turn.1',
  system: 'SYSTEM',
  messages: [{ role: 'user', content: 'hello' }],
  limits: { maxOutputTokens: null, timeoutMs: 2000 },
};
const http = (timeoutMs: number, signal?: AbortSignal) => ({ timeoutMs, signal, ...noWait() });

let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  await close?.();
  close = null;
});

const anthropicOk = (text: string, extra: Record<string, unknown> = {}) => ({
  status: 200,
  headers: { 'request-id': 'req_abc' },
  body: { id: 'msg_1', type: 'message', model: 'claude-sonnet-5-5', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 40, cache_creation_input_tokens: 10 }, ...extra },
});

describe('anthropic adapter (mock server; the real API is not reachable without a key)', () => {
  it('sends the documented request shape and never anything beyond system + messages', async () => {
    const m = await mockServer(() => anthropicOk('{"action":{"type":"RESET"}}'));
    close = m.close;
    const a = anthropicAdapter({ apiKey: KEY, modelId: 'claude-sonnet-5-5', baseUrl: m.url, http });
    const r = await a.decide(req);
    const seen = m.seen[0]!;
    expect(seen.method).toBe('POST');
    expect(seen.url).toBe('/v1/messages');
    expect(seen.headers['x-api-key']).toBe(KEY);
    expect(seen.headers['anthropic-version']).toBe('2023-06-01');
    expect(seen.body).toEqual({ model: 'claude-sonnet-5-5', max_tokens: 16000, system: 'SYSTEM', messages: [{ role: 'user', content: 'hello' }] });
    expect(r.raw).toBe('{"action":{"type":"RESET"}}');
    expect(r.providerRequestId).toBe('req_abc');
    expect(r.finishReason).toBe('end_turn');
    expect(r.respondedModel).toBe('claude-sonnet-5-5');
  });

  it('normalises usage: input = uncached + cache reads + cache writes; cached = cache reads', async () => {
    const m = await mockServer(() => anthropicOk('x'));
    close = m.close;
    const r = await anthropicAdapter({ apiKey: KEY, modelId: 'claude-sonnet-5-5', baseUrl: m.url, http }).decide(req);
    expect(r.usage).toEqual({ inputTokens: 150, outputTokens: 20, cachedInputTokens: 40, reasoningTokens: null });
  });

  it('joins only text blocks (thinking/tool blocks are ignored)', async () => {
    const m = await mockServer(() => ({ status: 200, body: { content: [{ type: 'thinking', thinking: 'secret' }, { type: 'text', text: 'A' }, { type: 'text', text: 'B' }], usage: {} } }));
    close = m.close;
    expect((await anthropicAdapter({ apiKey: KEY, modelId: 'm', baseUrl: m.url, http }).decide(req)).raw).toBe('AB');
  });

  it('retries 429 and 5xx with an identical request, then succeeds', async () => {
    const m = await mockServer((_s, n) => (n === 1 ? { status: 429, body: { error: 'slow down' } } : n === 2 ? { status: 503, body: {} } : anthropicOk('ok')));
    close = m.close;
    const r = await anthropicAdapter({ apiKey: KEY, modelId: 'm', baseUrl: m.url, http }).decide(req);
    expect(r.retries).toBe(2);
    expect(m.seen).toHaveLength(3);
    expect(m.seen[0]!.body).toEqual(m.seen[2]!.body);
  });

  it('maps errors: auth, rate limit after retries, context overflow, other 4xx, timeout, network', async () => {
    const cases: [number, unknown, string][] = [
      [401, { error: 'bad key' }, 'auth'],
      [429, { error: 'x' }, 'rate_limit'],
      [400, { error: { message: 'prompt is too long: 250000 tokens > 200000 maximum' } }, 'context_overflow'],
      [400, { error: { message: 'invalid thing' } }, 'provider'],
      [500, { error: 'boom' }, 'provider'],
    ];
    for (const [status, body, kind] of cases) {
      const m = await mockServer(() => ({ status, body }));
      const err = await anthropicAdapter({ apiKey: KEY, modelId: 'm', baseUrl: m.url, http }).decide(req).catch((e: unknown) => e);
      await m.close();
      expect(err, String(status)).toBeInstanceOf(AdapterError);
      expect((err as AdapterError).kind, String(status)).toBe(kind);
    }
    const slow = await mockServer(() => ({ status: 200, body: {}, delayMs: 400 }));
    const t = await anthropicAdapter({ apiKey: KEY, modelId: 'm', baseUrl: slow.url, http: (_ms, s) => ({ timeoutMs: 50, signal: s, ...noWait() }) }).decide(req).catch((e: unknown) => e);
    await slow.close();
    expect((t as AdapterError).kind).toBe('timeout');
    const net = await anthropicAdapter({ apiKey: KEY, modelId: 'm', baseUrl: 'http://127.0.0.1:1', http }).decide(req).catch((e: unknown) => e);
    expect((net as AdapterError).kind).toBe('transport');
  });

  it('lists model ids for preflight', async () => {
    const m = await mockServer(() => ({ status: 200, body: { data: [{ id: 'claude-sonnet-5-5' }, { id: 'claude-haiku-5-5' }] } }));
    close = m.close;
    expect(await listAnthropicModels(KEY, m.url)).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5']);
    expect(m.seen[0]!.url).toBe('/v1/models?limit=1000');
  });
});

describe('openai adapter (mock server)', () => {
  const chatOk = (text: string) => ({
    status: 200,
    headers: { 'x-request-id': 'req_oa' },
    body: { id: 'chatcmpl-1', model: 'some-model-2026', choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 200, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 64 }, completion_tokens_details: { reasoning_tokens: 30 } } },
  });

  it('chat: sends system as the first message, bearer auth, and no temperature unless configured', async () => {
    const m = await mockServer(() => chatOk('{"action":{"type":"RESET"}}'));
    close = m.close;
    const r = await openaiAdapter({ apiKey: KEY, modelId: 'some-model', baseUrl: m.url, http }).decide(req);
    const seen = m.seen[0]!;
    expect(seen.url).toBe('/v1/chat/completions');
    expect(seen.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(seen.body).toEqual({ model: 'some-model', messages: [{ role: 'system', content: 'SYSTEM' }, { role: 'user', content: 'hello' }] });
    expect(r.usage).toEqual({ inputTokens: 200, outputTokens: 50, cachedInputTokens: 64, reasoningTokens: 30 });
    expect(r.respondedModel).toBe('some-model-2026');
    expect(r.providerRequestId).toBe('req_oa');
  });

  it('responses: uses instructions/input and reads output_text parts', async () => {
    const m = await mockServer(() => ({
      status: 200,
      body: { id: 'resp_1', model: 'm', status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"action":{"type":"COMMIT"}}' }] }], usage: { input_tokens: 10, output_tokens: 5, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 2 } } },
    }));
    close = m.close;
    const r = await openaiAdapter({ apiKey: KEY, modelId: 'm', api: 'responses', baseUrl: m.url, http }).decide(req);
    expect(m.seen[0]!.url).toBe('/v1/responses');
    expect(m.seen[0]!.body).toEqual({ model: 'm', instructions: 'SYSTEM', input: [{ role: 'user', content: 'hello' }] });
    expect(r.raw).toBe('{"action":{"type":"COMMIT"}}');
    expect(r.usage).toEqual({ inputTokens: 10, outputTokens: 5, cachedInputTokens: 0, reasoningTokens: 2 });
  });

  it('maps auth and context errors', async () => {
    const m1 = await mockServer(() => ({ status: 401, body: {} }));
    expect(((await openaiAdapter({ apiKey: KEY, modelId: 'm', baseUrl: m1.url, http }).decide(req).catch((e: unknown) => e)) as AdapterError).kind).toBe('auth');
    await m1.close();
    const m2 = await mockServer(() => ({ status: 400, body: { error: { message: "This model's maximum context length is 128000 tokens" } } }));
    expect(((await openaiAdapter({ apiKey: KEY, modelId: 'm', baseUrl: m2.url, http }).decide(req).catch((e: unknown) => e)) as AdapterError).kind).toBe('context_overflow');
    await m2.close();
  });

  it('lists model ids for preflight', async () => {
    const m = await mockServer(() => ({ status: 200, body: { data: [{ id: 'a' }, { id: 'b' }] } }));
    close = m.close;
    expect(await listOpenAIModels(KEY, m.url)).toEqual(['a', 'b']);
  });
});

describe('full attempts through the HTTP adapters', () => {
  it('plays a whole world over HTTP, verifies, and the API key appears nowhere in the record or logs', async () => {
    const l = level('w02');
    const plan = planFor(l);
    let turn = 0;
    const m = await mockServer(() => anthropicOk(JSON.stringify({ action: plan[turn++] })));
    close = m.close;
    const adapter = anthropicAdapter({ apiKey: KEY, modelId: 'claude-sonnet-5-5', baseUrl: m.url, http });
    const { record, logs } = await runAttempt({ attemptId: 'a1', seed: 's', level: l, adapter, configHash: 'c', promptHash: 'p', runnerVersion: 't', engineVersion: 't' });
    expect(record.outcome.status).toBe('won');
    expect(verifyRecord(record, l).ok).toBe(true);
    const dump = JSON.stringify(record) + JSON.stringify(logs);
    expect(dump).not.toContain(KEY);
    expect(dump).not.toContain('x-api-key');
    // every request carried the key in the header only
    expect(m.seen.every((s) => s.headers['x-api-key'] === KEY)).toBe(true);
    // the model received the full history each call (turn n has 2n-1 messages)
    expect(m.seen.map((s) => (s.body?.messages as unknown[]).length)).toEqual(plan.map((_, i) => 2 * i + 1));
  });

  it('a mid-attempt provider outage voids the attempt (not a loss) and the partial record verifies', async () => {
    const l = level('w01');
    let n = 0;
    const m = await mockServer(() => (n++ < 3 ? anthropicOk('{"action":{"type":"MOVE","direction":"RIGHT"}}') : { status: 500, body: {} }));
    close = m.close;
    const adapter = anthropicAdapter({ apiKey: KEY, modelId: 'm', baseUrl: m.url, http });
    const { record } = await runAttempt({ attemptId: 'a2', seed: 's', level: l, adapter, configHash: 'c', promptHash: 'p', runnerVersion: 't', engineVersion: 't' });
    expect(record.outcome.status).toBe('void');
    expect(record.outcome.voidReason).toBe('provider');
    expect(record.steps).toHaveLength(3);
    expect(verifyRecord(record, l).ok).toBe(true);
  });
});
