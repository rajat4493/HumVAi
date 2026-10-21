import { AdapterError } from '../types';

export interface HttpOptions {
  timeoutMs: number;
  maxRetries: number;
  /** Delay before retry n (1-based); overridable so tests do not sleep. */
  backoffMs: (n: number) => number;
  signal?: AbortSignal | undefined;
}

export interface HttpResult {
  json: Record<string, unknown>;
  headers: Headers;
  retries: number;
  latencyMs: number;
}

const CONTEXT_HINTS = /context|too long|maximum.*tokens|prompt is too long|reduce the length/i;

/**
 * POST/GET JSON with retries on transport errors, 429 and 5xx (identical request each time).
 * Never logs or returns request headers, so API keys cannot leak through here.
 */
export async function httpJson(url: string, init: RequestInit, o: HttpOptions): Promise<HttpResult> {
  let retries = 0;
  for (;;) {
    const t0 = performance.now();
    let res: Response;
    try {
      const timeout = AbortSignal.timeout(o.timeoutMs);
      res = await fetch(url, { ...init, signal: o.signal ? AbortSignal.any([timeout, o.signal]) : timeout });
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') throw new AdapterError('timeout', `request timed out after ${o.timeoutMs} ms`);
      if (retries < o.maxRetries) {
        retries += 1;
        await new Promise((r) => setTimeout(r, o.backoffMs(retries)));
        continue;
      }
      throw new AdapterError('transport', `network error: ${e instanceof Error ? e.message : String(e)}`);
    }
    const text = await res.text();
    const latencyMs = performance.now() - t0;
    if (res.ok) {
      try {
        return { json: JSON.parse(text) as Record<string, unknown>, headers: res.headers, retries, latencyMs };
      } catch {
        throw new AdapterError('provider', 'provider returned non-JSON success body', res.status);
      }
    }
    if ((res.status === 429 || res.status >= 500) && retries < o.maxRetries) {
      retries += 1;
      await new Promise((r) => setTimeout(r, o.backoffMs(retries)));
      continue;
    }
    const snippet = text.slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new AdapterError('auth', `authentication failed (HTTP ${res.status})`, res.status);
    if (res.status === 429) throw new AdapterError('rate_limit', 'rate limited', res.status);
    if (res.status === 400 && CONTEXT_HINTS.test(snippet)) throw new AdapterError('context_overflow', snippet, res.status);
    throw new AdapterError('provider', `HTTP ${res.status}: ${snippet}`, res.status);
  }
}

export const defaultHttp = (timeoutMs: number, signal?: AbortSignal): HttpOptions => ({
  timeoutMs,
  maxRetries: 3,
  backoffMs: (n) => 1000 * 2 ** (n - 1),
  signal,
});
