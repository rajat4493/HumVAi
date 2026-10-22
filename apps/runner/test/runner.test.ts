import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { LEVELS, solve } from '@hva/game-core';
import { AdapterError, scriptedAdapter, verifyRecord } from '@hva/ai-adapters';
import type { GameAction } from '@hva/game-core';
import type { ModelAdapter, RunRecord } from '@hva/ai-adapters';
import { levelsById, runExperiment } from '../src/exec';
import { buildReport } from '../src/report';
import { paths, readJsonl } from '../src/store';
import { configHash, parseSpec, promptHash } from '../src/config';
import { mockServer } from '../../../packages/ai-adapters/test/helpers';

const run = promisify(execFile);
const tmp = () => mkdtempSync(join(tmpdir(), 'hva-runner-'));
const plan = (l: (typeof LEVELS)[number]): GameAction[] => [...(l.budget.explore > 0 ? [{ type: 'COMMIT' } as GameAction] : []), ...(solve(l).optimalSolution as GameAction[])];

/** A scripted "model" per level, resolved from the user message's briefing. */
function perLevelScripted(): ModelAdapter {
  const adapters = new Map(LEVELS.map((l) => [l.briefing, scriptedAdapter(plan(l))]));
  return {
    identity: { provider: 'test', modelId: 'scripted', displayName: 'Reference solver (not an AI)' },
    sampling: {},
    async decide(req, signal) {
      const first = req.messages[0]!.content;
      const key = [...adapters.keys()].find((b) => first.includes(`BRIEFING\n${b}`)) as string;
      const a = adapters.get(key) as ModelAdapter;
      // each attempt is a fresh script: rebuild at the first turn of an attempt
      if (req.messages.length === 1) adapters.set(key, scriptedAdapter(plan(LEVELS.find((l) => l.briefing === key)!)));
      return (adapters.get(key) as ModelAdapter).decide(req, signal ?? undefined) ?? a.decide(req, signal);
    },
  };
}

describe('experiment execution', () => {
  it('runs every world twice, interleaved, stores verified records and calls, and resumes without duplicating', async () => {
    const dir = tmp();
    const opts = { adapters: [perLevelScripted()], levels: levelsById(undefined), attemptsPerLevel: 2, outDir: dir, version: 'test', maxTotalTokens: 1e9 };
    const first = await runExperiment(opts);
    expect(first.completed).toHaveLength(LEVELS.length * 2);
    const records = readJsonl<RunRecord>(paths(dir).records);
    expect(records).toHaveLength(LEVELS.length * 2);
    expect(records.every((r) => r.outcome.status === 'won')).toBe(true);
    for (const r of records) expect(verifyRecord(r, LEVELS.find((l) => l.id === r.challengeId)!).ok).toBe(true);
    expect(readJsonl(paths(dir).meta).every((m) => (m as { verified: boolean }).verified)).toBe(true);
    const order = records.map((r) => r.challengeId);
    expect(order).not.toEqual([...order].sort()); // interleaved, not grouped by world
    const second = await runExperiment(opts);
    expect(second.skipped).toBe(LEVELS.length * 2);
    expect(readJsonl(paths(dir).records)).toHaveLength(LEVELS.length * 2);
  });

  it('the shuffled order is deterministic for a given seed', async () => {
    const a = tmp(), b = tmp();
    const mk = (outDir: string) => ({ adapters: [perLevelScripted()], levels: levelsById(undefined), attemptsPerLevel: 2, outDir, version: 't', maxTotalTokens: 1e9, seedPrefix: 'same' });
    await runExperiment(mk(a));
    await runExperiment(mk(b));
    const ids = (d: string) => readJsonl<RunRecord>(paths(d).records).map((r) => r.attemptId);
    expect(ids(a)).toEqual(ids(b));
  });

  it('stops when the token cap is reached and records why', async () => {
    const dir = tmp();
    const costly: ModelAdapter = { ...perLevelScripted(), async decide(req, s) { const r = await perLevelScripted().decide(req, s); return { ...r, usage: { ...r.usage, inputTokens: 1000 } }; } };
    const res = await runExperiment({ adapters: [costly], levels: levelsById(['w01']), attemptsPerLevel: 5, outDir: dir, version: 't', maxTotalTokens: 5000 });
    expect(res.stoppedBecause).toBeTruthy();
    expect(res.completed.length + 0).toBeLessThan(5);
  });

  it('the spend cap is enforced from the operator price table (new attempts stop at 90%)', async () => {
    const dir = tmp();
    const a = perLevelScripted();
    const priced: ModelAdapter = { ...a, identity: { provider: 'test', modelId: 'priced', displayName: 'x' }, async decide(req, s) { const r = await a.decide(req, s); return { ...r, usage: { ...r.usage, inputTokens: 100_000 } }; } };
    const res = await runExperiment({ adapters: [priced], levels: levelsById(['w01']), attemptsPerLevel: 10, outDir: dir, version: 't', prices: { 'test:priced': { inputPerMTok: 1, outputPerMTok: 0 } }, spendCapUsd: 3 });
    // each w01 attempt (8 calls x 100k tokens) costs $0.80. 90% of $3 = $2.70: three attempts finish ($2.40),
    // the fourth starts and is stopped mid-attempt at exactly the $3.00 cap, recorded as a void (never a loss).
    expect(res.completed).toHaveLength(3);
    expect(res.stoppedBecause).toBe('spend-cap');
    expect(res.spentUsd).toBeCloseTo(3.0, 6);
    const recs = readJsonl<RunRecord>(paths(dir).records);
    expect(recs.at(-1)?.outcome).toMatchObject({ status: 'void', voidReason: 'spend-cap' });
    expect(recs.every((r) => verifyRecord(r, LEVELS[0]!).ok)).toBe(true);
  });

  it('voids are kept in the records, retried, and never counted as losses', async () => {
    const dir = tmp();
    const base = perLevelScripted();
    let calls = 0;
    const flaky: ModelAdapter = {
      ...base,
      async decide(req, s) {
        if (calls++ === 2) throw new AdapterError('provider', 'blip');
        return base.decide(req, s);
      },
    };
    const res = await runExperiment({ adapters: [flaky], levels: levelsById(['w01']), attemptsPerLevel: 1, outDir: dir, version: 't', maxTotalTokens: 1e9 });
    const recs = readJsonl<RunRecord>(paths(dir).records);
    expect(recs.map((r) => r.outcome.status)).toEqual(['void', 'won']);
    expect(recs[1]!.attemptId).toContain('#retry1');
    expect(res.completed).toHaveLength(1);
    const report = buildReport(recs, 't');
    expect(report).toContain('2 / 2 verified');
    expect(report).toContain('| w01-first-steps | 2 | 1 | 0 | 0 | 1 |'); // the void is counted but not as a loss
  });

  it('config hash changes when identity, sampling or prompt would change', () => {
    const a = perLevelScripted();
    const b: ModelAdapter = { ...a, sampling: { temperature: 0.5 } };
    expect(configHash(a)).not.toBe(configHash(b));
    expect(promptHash()).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('model spec parsing', () => {
  it('accepts provider:id and rejects anything else', () => {
    expect(parseSpec('anthropic:claude-sonnet-5-5')).toEqual({ provider: 'anthropic', modelId: 'claude-sonnet-5-5' });
    expect(() => parseSpec('claude-sonnet-5-5')).toThrow();
    expect(() => parseSpec('gemini:x')).toThrow();
  });
});

describe('CLI (subprocess)', () => {
  const cli = (args: string[], env: Record<string, string> = {}) =>
    run('npx', ['tsx', 'apps/runner/src/cli.ts', ...args], { cwd: join(__dirname, '../../..'), env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', ...env } }).then(
      (r) => ({ code: 0, out: r.stdout + r.stderr }),
      (e: { code?: number; stdout?: string; stderr?: string }) => ({ code: e.code ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }),
    );

  it('refuses to spend without --live and without a cap', async () => {
    const dir = tmp();
    expect((await cli(['run', '--model', 'anthropic:x', '--out', dir])).out).toContain('without --live');
    expect((await cli(['run', '--live', '--model', 'anthropic:x', '--out', dir], { ANTHROPIC_API_KEY: 'k' })).out).toContain('spending limit is required');
    expect((await cli(['run', '--live', '--model', 'anthropic:x', '--out', dir, '--spend-cap-usd', '1'], { ANTHROPIC_API_KEY: 'k' })).out).toContain('needs --prices');
  }, 60_000);

  it('preflight fails clearly when a key is missing', async () => {
    const r = await cli(['preflight', '--model', 'anthropic:claude-sonnet-5-5', '--model', 'openai:some-model']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('ANTHROPIC_API_KEY is not set');
    expect(r.out).toContain('OPENAI_API_KEY is not set');
  }, 60_000);

  it('preflight checks the model id against the provider list (mock servers)', async () => {
    const a = await mockServer(() => ({ status: 200, body: { data: [{ id: 'claude-sonnet-5-5' }] } }));
    const o = await mockServer(() => ({ status: 200, body: { data: [{ id: 'listed-model' }] } }));
    const env = { ANTHROPIC_API_KEY: 'ka', OPENAI_API_KEY: 'ko', HVA_ANTHROPIC_BASE_URL: a.url, HVA_OPENAI_BASE_URL: o.url };
    const good = await cli(['preflight', '--model', 'anthropic:claude-sonnet-5-5', '--model', 'openai:listed-model'], env);
    const bad = await cli(['preflight', '--model', 'openai:invented-model'], env);
    await a.close();
    await o.close();
    expect(good.code).toBe(0);
    expect(good.out).toContain('OK   anthropic:claude-sonnet-5-5');
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("NOT in the provider's model list");
  }, 60_000);

  it('end to end: live run against a mock provider, verify, report; the key never reaches any output file', async () => {
    const KEY = 'sk-ant-SENTINEL-abcdef';
    const l = LEVELS[0]!;
    const moves = plan(l);
    let n = 0;
    const m = await mockServer(() => {
      const a = moves[n++ % moves.length];
      return { status: 200, headers: { 'request-id': 'r1' }, body: { id: 'm', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: JSON.stringify({ action: a }) }], stop_reason: 'end_turn', usage: { input_tokens: 500, output_tokens: 20 } } };
    });
    const dir = tmp();
    const prices = join(dir, 'prices.json');
    writeFileSync(prices, JSON.stringify({ 'anthropic:claude-sonnet-5-5': { inputPerMTok: 3, outputPerMTok: 15 } }));
    const env = { ANTHROPIC_API_KEY: KEY, HVA_ANTHROPIC_BASE_URL: m.url };
    const out = join(dir, 'out');
    const r = await cli(['run', '--live', '--model', 'anthropic:claude-sonnet-5-5', '--out', out, '--levels', 'w01', '--attempts', '1', '--prices', prices, '--spend-cap-usd', '1'], env);
    await m.close();
    expect(r.code).toBe(0);
    expect(r.out).toContain('won');
    const v = await cli(['verify', '--out', out]);
    expect(v.out).toContain('1/1 verified');
    const rep = await cli(['report', '--out', out]);
    expect(rep.out).toContain('1 / 1 verified');
    expect(rep.out).toContain('claude-sonnet-5-5');
    const rec = readJsonl<RunRecord>(join(out, 'records.jsonl'))[0]!;
    expect(rec.totals.costUsd).toBeCloseTo((8 * 500 * 3 + 8 * 20 * 15) / 1e6, 8);
    expect(rec.model.modelId).toBe('claude-sonnet-5-5');
    for (const f of readdirSync(out)) expect(readFileSync(join(out, f), 'utf8'), f).not.toContain(KEY);
    expect(r.out).not.toContain(KEY);
  }, 90_000);
});

describe('cost estimate (no network)', () => {
  it('grows with the square of the calls, scales with attempts, and the worst case bounds the likely case', async () => {
    const { estimateAttempt, estimateUsd } = await import('../src/estimate');
    const w1 = estimateAttempt(LEVELS[0]!, { outputPerCall: 600, maxOutputTokens: 16000 });
    const w20 = estimateAttempt(LEVELS[19]!, { outputPerCall: 600, maxOutputTokens: 16000 });
    expect(w1.likelyCalls).toBe(8); // World 1 has no scouting: the optimal run is 8 actions
    expect(w1.maxCalls).toBe(12 + 20 + 10);
    expect(w20.likelyCalls).toBe(16); // commit + 15
    expect(w1.worstInputTokens).toBeGreaterThan(w1.likelyInputTokens);
    expect(w1.worstOutputTokens).toBeGreaterThan(w1.likelyOutputTokens);
    const price = { inputPerMTok: 2, outputPerMTok: 10 };
    const one = estimateUsd(w1, price, 1);
    const three = estimateUsd(w1, price, 3);
    expect(three.likely).toBeCloseTo(one.likely * 3, 10);
    expect(one.worst).toBeGreaterThan(one.likely);
    expect(one.likely).toBeGreaterThan(0);
  });

  it('the estimate command needs prices (nothing is guessed), prints a cost with them, and never needs a key', async () => {
    const root = join(__dirname, '../../..');
    const go = (args: string[]) =>
      run('npx', ['tsx', 'apps/runner/src/cli.ts', ...args], { cwd: root, env: { ...process.env, ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } }).then(
        (r) => ({ code: 0, out: r.stdout + r.stderr }),
        (e: { code?: number; stdout?: string; stderr?: string }) => ({ code: e.code ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') }),
      );
    expect((await go(['estimate', '--model', 'anthropic:claude-sonnet-5-5'])).out).toContain('--prices is required');
    const prices = join(tmp(), 'prices.json');
    writeFileSync(prices, JSON.stringify({ 'anthropic:claude-sonnet-5-5': { inputPerMTok: 2, outputPerMTok: 10 } }));
    const ok = await go(['estimate', '--model', 'anthropic:claude-sonnet-5-5', '--prices', prices, '--levels', 'w01-first-steps', '--max-output-tokens', '4000']);
    expect(ok.code).toBe(0);
    expect(ok.out).toMatch(/w01-first-steps: 8 calls/);
    expect(ok.out).toMatch(/TOTAL: likely \$\d/);
  }, 60_000);
});
