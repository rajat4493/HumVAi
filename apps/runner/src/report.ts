import { LEVELS, solve } from '@hva/game-core';
import { summarize, verifyRecord } from '@hva/ai-adapters';
import type { RunRecord } from '@hva/ai-adapters';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const money = (x: number | null) => (x === null ? 'n/a (no price table)' : `$${x.toFixed(4)}`);
const ms = (x: number | null) => (x === null ? '-' : x >= 1000 ? `${(x / 1000).toFixed(1)} s` : `${Math.round(x)} ms`);

/** Markdown report regenerated entirely from records; re-verifies every record rather than trusting stored flags. */
export function buildReport(records: RunRecord[], title: string): string {
  const lines = [`# ${title}`, '', `Records: ${records.length}. Generated from \`records.jsonl\` by \`npm run runner -- report\`; every record re-verified at generation time.`, ''];
  const byModel = new Map<string, RunRecord[]>();
  for (const r of records) byModel.set(`${r.model.provider}:${r.model.modelId}`, [...(byModel.get(`${r.model.provider}:${r.model.modelId}`) ?? []), r]);
  const unverified: string[] = [];
  const good = records.filter((r) => {
    const level = LEVELS.find((l) => l.id === r.challengeId && l.version === r.challengeVersion);
    const v = level ? verifyRecord(r, level) : { ok: false, errors: ['unknown level/version'] };
    if (!v.ok) unverified.push(`${r.attemptId}: ${v.errors[0]}`);
    return v.ok;
  });
  lines.push(`Replay verification: **${good.length} / ${records.length} verified**${unverified.length ? `; excluded: ${unverified.join('; ')}` : ''}.`, '');

  for (const [model, rs] of byModel) {
    lines.push(`## ${model}`, '', '| World | Attempts | Won | Lost | Forfeit | Void | Win rate (95% Wilson) | Run median (optimal) | Scout median | Legal-action rate | Calls | In/Out tokens | Cost | Latency p50 / p90 | Wall median |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    const levels = [...new Set(rs.map((r) => r.challengeId))];
    for (const id of levels) {
      const forLevel = rs.filter((r) => r.challengeId === id && good.includes(r));
      if (forLevel.length === 0) continue;
      const s = summarize(forLevel);
      const opt = solve(LEVELS.find((l) => l.id === id)!).optimalLength;
      lines.push(
        `| ${id} | ${s.attempts} | ${s.won} | ${s.lost} | ${s.forfeit} | ${s.voided} | ${pct(s.winRate.lo)}-${pct(s.winRate.hi)} | ${s.medianRunActions ?? '-'} (${opt}) | ${s.medianScoutActions ?? '-'} | ${s.legalActionRate === null ? '-' : pct(s.legalActionRate)} | ${s.calls} | ${s.inputTokens.toLocaleString('en-US')} / ${s.outputTokens.toLocaleString('en-US')} | ${money(s.costUsd)} | ${ms(s.latencyMsP50)} / ${ms(s.latencyMsP90)} | ${ms(s.wallMsMedian)} |`,
      );
    }
    const all = rs.filter((r) => good.includes(r));
    if (all.length > 0) {
      const t = summarize(all);
      lines.push(`| **all** | ${t.attempts} | ${t.won} | ${t.lost} | ${t.forfeit} | ${t.voided} | | | | ${t.legalActionRate === null ? '-' : pct(t.legalActionRate)} | ${t.calls} | ${t.inputTokens.toLocaleString('en-US')} / ${t.outputTokens.toLocaleString('en-US')} | ${money(t.costUsd)} | ${ms(t.latencyMsP50)} / ${ms(t.latencyMsP90)} | |`);
    }
    lines.push('');
  }
  const flagged = records.filter((r) => r.flags.length > 0);
  if (flagged.length) lines.push('## Flags', '', ...flagged.map((r) => `- ${r.attemptId}: ${r.flags.join(', ')}`), '');
  return lines.join('\n');
}
