import { writeFileSync } from 'node:fs';
import { LEVELS } from '@hva/game-core';
import type { RunRecord } from '@hva/ai-adapters';
import { verifyRecord } from '@hva/ai-adapters';
import { listAnthropicModels, listOpenAIModels } from '@hva/ai-adapters/providers';
import { estimateAttempt, estimateUsd } from './estimate';
import { baseUrlOverride, gitVersion, loadPrices, makeAdapter, parseSpec, promptHash } from './config';
import { levelsById, runExperiment } from './exec';
import { publishRecordings } from './publish';
import { buildReport } from './report';
import { paths, readJsonl } from './store';

const USAGE = `hva runner (server-side only; API keys come from the environment, never the browser)

  preflight --model <provider:id> [--model ...]
      Check each key is set and the model id exists in the provider's own model list.
  run --live --model <provider:id> [--model ...] --out <dir> [--levels w01,w02] [--attempts N]
      [--prices prices.json --spend-cap-usd N | --max-total-tokens N] [--max-output-tokens N] [--openai-api chat|responses]
      Live runs REQUIRE --live and a cap. They stop at 90% (no new attempts) and 100% (mid-attempt).
  estimate --model <provider:id> --prices prices.json [--levels w01,w02] [--attempts N] [--max-output-tokens N] [--assume-output-tokens N]
      Costs nothing and calls nothing. Prints the likely and the worst-case cost of a run from the real prompt and an optimal
      playthrough (every call re-sends the whole history). Use it to pick --spend-cap-usd before any live run.
  verify --out <dir>          Re-verify every record against the engine; non-zero exit on any failure.
  report --out <dir> [--title T] [--write file.md]
  publish --out <dir> --model <provider:id> [--to apps/web/public/recordings]
      Turn verified records of ONE real model into the static recordings the game ships (test players are refused).
`;

function parseArgs(argv: string[]): { cmd: string; flags: Map<string, string[]>; bools: Set<string> } {
  const [cmd = '', ...rest] = argv;
  const flags = new Map<string, string[]>();
  const bools = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as string;
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const name = a.slice(2);
    if (name === 'live') bools.add(name);
    else flags.set(name, [...(flags.get(name) ?? []), rest[++i] ?? '']);
  }
  return { cmd, flags, bools };
}

async function main(): Promise<number> {
  const { cmd, flags, bools } = parseArgs(process.argv.slice(2));
  const one = (n: string) => flags.get(n)?.[0];
  const out = one('out');

  if (cmd === 'preflight') {
    let bad = 0;
    for (const s of (flags.get('model') ?? []).map(parseSpec)) {
      const keyName = s.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
      const key = process.env[keyName];
      if (!key) {
        console.log(`FAIL ${s.provider}:${s.modelId} - ${keyName} is not set`);
        bad++;
        continue;
      }
      try {
        const base = baseUrlOverride(s.provider, process.env);
        const ids = s.provider === 'anthropic' ? await listAnthropicModels(key, base) : await listOpenAIModels(key, base);
        const ok = ids.includes(s.modelId);
        console.log(`${ok ? 'OK  ' : 'FAIL'} ${s.provider}:${s.modelId} - ${ok ? 'listed by the provider' : `NOT in the provider's model list (${ids.length} models; e.g. ${ids.slice(0, 5).join(', ')})`}`);
        if (!ok) bad++;
      } catch (e) {
        console.log(`FAIL ${s.provider}:${s.modelId} - ${e instanceof Error ? e.message : String(e)}`);
        bad++;
      }
    }
    return bad === 0 && (flags.get('model') ?? []).length > 0 ? 0 : 1;
  }

  if (cmd === 'estimate') {
    const prices = loadPrices(one('prices'));
    if (!prices) throw new Error('--prices is required: no price is guessed');
    const attempts = Number(one('attempts') ?? 1);
    const maxOut = Number(one('max-output-tokens') ?? 16000);
    const likelyOut = Number(one('assume-output-tokens') ?? 600);
    let any = false;
    for (const m of flags.get('model') ?? []) {
      const spec = parseSpec(m);
      const price = prices[`${spec.provider}:${spec.modelId}`];
      if (!price) throw new Error(`no price for ${m} in the prices file`);
      let likely = 0;
      let worst = 0;
      for (const level of levelsById(one('levels')?.split(','))) {
        const e = estimateAttempt(level, { outputPerCall: likelyOut, maxOutputTokens: maxOut });
        const usd = estimateUsd(e, price, attempts);
        likely += usd.likely;
        worst += usd.worst;
        console.log(`${m} ${level.id}: ${e.likelyCalls} calls if played well (hard ceiling ${e.maxCalls}); input ~${e.likelyInputTokens} tokens likely, ~${e.worstInputTokens} worst; x${attempts} attempt(s): likely $${usd.likely.toFixed(4)}, worst $${usd.worst.toFixed(4)}`);
        any = true;
      }
      console.log(`${m} TOTAL: likely $${likely.toFixed(4)}; worst case $${worst.toFixed(4)} (assumes ${likelyOut} output tokens per call normally and ${maxOut} per call in the worst case, ${3} characters per token)`);
      console.log('The spend cap you pass to `run` is what actually limits spending; this is only to choose it sensibly.');
    }
    return any ? 0 : 1;
  }

  if (cmd === 'run') {
    if (!bools.has('live')) throw new Error('refusing to call real models without --live');
    if (!out) throw new Error('--out <dir> is required');
    const cap = one('spend-cap-usd');
    const tokenCap = one('max-total-tokens');
    const prices = loadPrices(one('prices'));
    if (cap === undefined && tokenCap === undefined) throw new Error('a spending limit is required: --spend-cap-usd (with --prices) or --max-total-tokens');
    if (cap !== undefined && !prices) throw new Error('--spend-cap-usd needs --prices (no price is guessed)');
    const openaiApi = one('openai-api') === 'responses' ? 'responses' : 'chat';
    const maxOut = one('max-output-tokens');
    const sampling = maxOut === undefined ? undefined : { maxOutputTokens: Number(maxOut) };
    const adapters = (flags.get('model') ?? []).map((m) => makeAdapter(parseSpec(m), process.env, { openaiApi, ...(sampling ? { sampling } : {}) }));
    if (adapters.length === 0) throw new Error('at least one --model is required');
    if (prices) for (const a of adapters) if (!prices[`${a.identity.provider}:${a.identity.modelId}`]) console.warn(`warning: no price for ${a.identity.provider}:${a.identity.modelId}; its cost is not counted toward the cap`);
    const res = await runExperiment({
      adapters,
      levels: levelsById(one('levels')?.split(',')),
      attemptsPerLevel: Number(one('attempts') ?? 1),
      outDir: out,
      prices,
      spendCapUsd: cap === undefined ? undefined : Number(cap),
      maxTotalTokens: tokenCap === undefined ? undefined : Number(tokenCap),
      version: gitVersion(),
      log: (l) => console.log(l),
    });
    console.log(JSON.stringify({ completed: res.completed.length, skipped: res.skipped, stoppedBecause: res.stoppedBecause, spentUsd: res.spentUsd, totalTokens: res.totalTokens, promptHash: promptHash() }, null, 2));
    return res.stoppedBecause ? 2 : 0;
  }

  if (cmd === 'verify' || cmd === 'report') {
    if (!out) throw new Error('--out <dir> is required');
    const records = readJsonl<RunRecord>(paths(out).records);
    if (cmd === 'report') {
      const md = buildReport(records, one('title') ?? `Runner report: ${out}`);
      if (one('write')) writeFileSync(one('write') as string, md);
      console.log(md);
      return 0;
    }
    let bad = 0;
    for (const r of records) {
      const level = LEVELS.find((l) => l.id === r.challengeId && l.version === r.challengeVersion);
      const v = level ? verifyRecord(r, level) : { ok: false, errors: ['unknown level/version'] };
      console.log(`${v.ok ? 'OK  ' : 'FAIL'} ${r.attemptId}${v.ok ? '' : ` - ${v.errors.join('; ')}`}`);
      if (!v.ok) bad++;
    }
    console.log(`${records.length - bad}/${records.length} verified`);
    return bad === 0 ? 0 : 1;
  }

  if (cmd === 'publish') {
    if (!out) throw new Error('--out <dir> is required');
    const spec = parseSpec(one('model') ?? '');
    const records = readJsonl<RunRecord>(paths(out).records);
    const res = publishRecordings(records, { provider: spec.provider, modelId: spec.modelId, to: one('to') ?? 'apps/web/public/recordings' });
    for (const f of res.written) console.log(`published ${f}`);
    for (const r of res.refused) console.log(`REFUSED ${r}`);
    return res.refused.length === 0 && res.written.length > 0 ? 0 : 1;
  }

  console.log(USAGE);
  return cmd === '' || cmd === 'help' ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  },
);
