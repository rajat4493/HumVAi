import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PROMPT_VERSION, SYSTEM_PROMPT, SCHEMA_RUN, priceKey } from '@hva/ai-adapters';
import type { ModelAdapter, PriceTable, SamplingConfig } from '@hva/ai-adapters';
import { anthropicAdapter, openaiAdapter } from '@hva/ai-adapters/providers';

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
export const promptHash = (): string => `sha256:${sha256(`${PROMPT_VERSION}\n${SYSTEM_PROMPT}`)}`;

export interface ModelSpec {
  provider: 'anthropic' | 'openai';
  modelId: string;
}

/** "anthropic:claude-sonnet-5-5" -> { provider, modelId } */
export function parseSpec(s: string): ModelSpec {
  const i = s.indexOf(':');
  const provider = s.slice(0, i);
  const modelId = s.slice(i + 1);
  if (i < 1 || !modelId || (provider !== 'anthropic' && provider !== 'openai')) {
    throw new Error(`model spec must look like anthropic:<model-id> or openai:<model-id>, got "${s}"`);
  }
  return { provider, modelId };
}

export interface Env {
  [k: string]: string | undefined;
}

/** Keys are read here, in the runner process only. They are never written to records, logs or the browser bundle. */
export function makeAdapter(spec: ModelSpec, env: Env, opts: { baseUrl?: string; openaiApi?: 'chat' | 'responses'; sampling?: SamplingConfig } = {}): ModelAdapter {
  const keyName = spec.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
  const apiKey = env[keyName];
  if (!apiKey) throw new Error(`${keyName} is not set`);
  const baseUrl = opts.baseUrl ?? baseUrlOverride(spec.provider, env);
  const common = { apiKey, modelId: spec.modelId, ...(baseUrl ? { baseUrl } : {}), ...(opts.sampling ? { sampling: opts.sampling } : {}) };
  return spec.provider === 'anthropic' ? anthropicAdapter(common) : openaiAdapter({ ...common, ...(opts.openaiApi ? { api: opts.openaiApi } : {}) });
}

/** Test/proxy hook: HVA_ANTHROPIC_BASE_URL / HVA_OPENAI_BASE_URL (deliberately not the SDK-standard variables). */
export function baseUrlOverride(provider: ModelSpec['provider'], env: Env): string | undefined {
  return env[provider === 'anthropic' ? 'HVA_ANTHROPIC_BASE_URL' : 'HVA_OPENAI_BASE_URL'];
}

export function configHash(adapter: ModelAdapter): string {
  const canonical = JSON.stringify({ identity: adapter.identity, sampling: adapter.sampling, prompt: promptHash(), schema: SCHEMA_RUN });
  return `sha256:${sha256(canonical).slice(0, 16)}`;
}

export function loadPrices(path: string | undefined): PriceTable | undefined {
  if (!path) return undefined;
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const table: PriceTable = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    const e = v as { inputPerMTok?: unknown; outputPerMTok?: unknown; cachedInputPerMTok?: unknown };
    if (typeof e.inputPerMTok !== 'number' || typeof e.outputPerMTok !== 'number') throw new Error(`prices.json: ${k} needs numeric inputPerMTok and outputPerMTok`);
    table[k] = { inputPerMTok: e.inputPerMTok, outputPerMTok: e.outputPerMTok, ...(typeof e.cachedInputPerMTok === 'number' ? { cachedInputPerMTok: e.cachedInputPerMTok } : {}) };
  }
  return table;
}

export function gitVersion(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() ? '-dirty' : '';
    return `git:${sha}${dirty}`;
  } catch {
    return 'git:unknown';
  }
}

export { priceKey };
