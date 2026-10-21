import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVELS, solve } from '@hva/game-core';
import type { GameAction } from '@hva/game-core';
import { anthropicAdapter } from '@hva/ai-adapters/providers';
import { checkOpponent, runAttempt, scriptedAdapter } from '@hva/ai-adapters';
import type { OpponentRecording, RunRecord } from '@hva/ai-adapters';
import { mockServer } from '../../../packages/ai-adapters/test/helpers';
import { publishRecordings } from '../src/publish';

const l1 = LEVELS[0]!;
const plan = solve(l1).optimalSolution as GameAction[];
const tmp = () => mkdtempSync(join(tmp_root(), 'hva-pub-'));
const tmp_root = () => tmpdir();

/** Real HTTP adapter against a local mock provider, so the records look exactly like live ones (and are not scripted/test records). */
async function mockProviderRecords(n: number): Promise<RunRecord[]> {
  let turn = 0;
  const m = await mockServer(() => {
    const a = plan[turn++ % plan.length];
    return { status: 200, headers: { 'request-id': 'r' }, body: { id: 'm', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: JSON.stringify({ action: a }) }], stop_reason: 'end_turn', usage: { input_tokens: 400, output_tokens: 15 } } };
  });
  const adapter = anthropicAdapter({ apiKey: 'k', modelId: 'claude-sonnet-5-5', baseUrl: m.url, http: (timeoutMs, signal) => ({ timeoutMs, signal, maxRetries: 0, backoffMs: () => 1 }) });
  const out: RunRecord[] = [];
  for (let i = 0; i < n; i++) {
    turn = 0;
    out.push((await runAttempt({ attemptId: `a${i}`, seed: `s${i}`, level: l1, adapter, configHash: 'cfg', promptHash: 'ph', runnerVersion: 't', engineVersion: 't', prices: { 'anthropic:claude-sonnet-5-5': { inputPerMTok: 3, outputPerMTok: 15 } } })).record);
  }
  await m.close();
  return out;
}

describe('publish', () => {
  it('turns verified records of one real model into a recording that passes the browser-side check, and writes the manifest', async () => {
    const records = await mockProviderRecords(3);
    const to = tmp();
    const res = publishRecordings(records, { provider: 'anthropic', modelId: 'claude-sonnet-5-5', to, now: new Date('2026-02-01T00:00:00Z') });
    expect(res).toEqual({ written: ['w01-first-steps.json'], refused: [] });
    const rec = JSON.parse(readFileSync(join(to, 'w01-first-steps.json'), 'utf8')) as OpponentRecording;
    expect(rec.kind).toBe('model');
    expect(rec.model.modelId).toBe('claude-sonnet-5-5');
    expect(rec.attempts).toHaveLength(3);
    expect(rec.measured.costUsd).toBeCloseTo((8 * 400 * 3 + 8 * 15 * 15) / 1e6, 8);
    expect(checkOpponent(rec, l1)).toEqual({ ok: true, errors: [] });
    expect(JSON.parse(readFileSync(join(to, 'index.json'), 'utf8'))).toEqual({ schema: 'hva.recordings.1', recordings: [{ challengeId: 'w01-first-steps', file: 'w01-first-steps.json' }] });
  });

  it('refuses scripted/test players: they can never become "AI recordings"', async () => {
    const { record } = await runAttempt({ attemptId: 's', seed: 's', level: l1, adapter: scriptedAdapter(plan), configHash: 'c', promptHash: 'p', runnerVersion: 't', engineVersion: 't' });
    const to = tmp();
    const res = publishRecordings([record], { provider: 'test', modelId: 'scripted', to });
    expect(res.written).toEqual([]);
    expect(res.refused[0]).toContain('cannot be published');
    expect(readdirSync(to)).toEqual([]);
  });

  it('refuses unverifiable records and mixed configurations, and publishes nothing for them', async () => {
    const good = await mockProviderRecords(2);
    const tampered: RunRecord = JSON.parse(JSON.stringify(good[0])) as RunRecord;
    tampered.outcome.runActions += 1;
    const to = tmp();
    const bad = publishRecordings([tampered, good[1]!], { provider: 'anthropic', modelId: 'claude-sonnet-5-5', to });
    expect(bad.written).toEqual([]);
    expect(bad.refused[0]).toContain('failed replay verification');
    const mixed = publishRecordings([good[0]!, { ...good[1]!, configHash: 'other' }], { provider: 'anthropic', modelId: 'claude-sonnet-5-5', to: tmp() });
    expect(mixed.written).toEqual([]);
    expect(mixed.refused[0]).toContain('different configurations');
  });

  it('ignores voids and other models', async () => {
    const good = await mockProviderRecords(1);
    const voided: RunRecord = { ...good[0]!, attemptId: 'v', outcome: { ...good[0]!.outcome, status: 'void', voidReason: 'x' } };
    const other: RunRecord = { ...good[0]!, model: { ...good[0]!.model, modelId: 'someone-else' } };
    const res = publishRecordings([voided, other, good[0]!], { provider: 'anthropic', modelId: 'claude-sonnet-5-5', to: tmp() });
    expect(res.written).toEqual(['w01-first-steps.json']);
  });
});
