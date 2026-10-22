// Turns the gameplay files players chose to send (Settings > Help test the game > Download) into one per-world table.
//   npx tsx tools/analyze-playtest.ts <dir-with-json-files> [--write docs/qa/playtest-results.md]
// Every attempt is replayed through the engine first; attempts that do not replay are listed and excluded.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPAIGN_ORDER, levelById, solve } from '@hva/game-core';
import { verifyAttempt } from '../apps/web/src/telemetry/verify';
import type { TAttempt, TelemetryFile } from '../apps/web/src/telemetry/types';

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] as number;
};
const pct = (k: number, n: number): string => (n === 0 ? '-' : `${Math.round((100 * k) / n)}%`);

export function analyze(files: { name: string; data: TelemetryFile }[]): string {
  const rejected: string[] = [];
  const good: { player: string; a: TAttempt }[] = [];
  for (const f of files) {
    if (f.data.schema !== 'hva.telemetry.1') {
      rejected.push(`${f.name}: unknown schema ${String(f.data.schema)}`);
      continue;
    }
    for (const a of f.data.attempts) {
      const level = levelById(a.levelId);
      const v = level ? verifyAttempt(a, level) : { ok: false, errors: ['unknown world'] };
      if (v.ok) good.push({ player: f.name, a });
      else rejected.push(`${f.name} ${a.id} (${a.levelId}@${a.levelVersion}): ${v.errors[0]}`);
    }
  }
  const lines = [
    '# Playtest results',
    '',
    `Players (files): ${files.length}. Attempts that replay cleanly: ${good.length}. Excluded: ${rejected.length}. Replay-verified means each attempt reproduces its recorded observations in the engine; it does not mean the player enjoyed anything.`,
    '',
    '| # | World | Players | Attempts | Won | Gave up | Median run actions (won) | Shortest | Hint use | Scout resets / attempt | Median minutes (won) |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  CAMPAIGN_ORDER.forEach((id, n) => {
    const level = levelById(id)!;
    const as = good.filter((g) => g.a.levelId === id && g.a.levelVersion === level.version);
    if (as.length === 0) {
      lines.push(`| ${n + 1} | ${level.name} | 0 | 0 | - | - | - | ${solve(level).optimalLength} | - | - | - |`);
      return;
    }
    const won = as.filter((g) => g.a.outcome?.status === 'won');
    const gaveUp = as.filter((g) => g.a.outcome?.status === 'abandoned');
    const hinted = as.filter((g) => g.a.hints.length > 0);
    lines.push(
      `| ${n + 1} | ${level.name} | ${new Set(as.map((g) => g.player)).size} | ${as.length} | ${pct(won.length, as.length)} | ${pct(gaveUp.length, as.length)} | ${median(won.map((g) => g.a.outcome!.runActions)) ?? '-'} | ${solve(level).optimalLength} | ${pct(hinted.length, as.length)} | ${(as.reduce((s, g) => s + (g.a.outcome?.scoutResets ?? 0), 0) / as.length).toFixed(1)} | ${
        median(won.map((g) => g.a.outcome!.durationMs / 60000))?.toFixed(1) ?? '-'
      } |`,
    );
  });
  if (rejected.length) lines.push('', '## Excluded attempts', '', ...rejected.map((r) => `- ${r}`));
  lines.push('', 'Rows use only attempts for the current version of each world. Small numbers: treat every figure as an anecdote until many people have played.');
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('analyze-playtest.ts')) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: tsx tools/analyze-playtest.ts <dir> [--write file]');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f, data: JSON.parse(readFileSync(join(dir, f), 'utf8')) as TelemetryFile }));
  const md = analyze(files);
  const w = process.argv.indexOf('--write');
  if (w > 0) writeFileSync(process.argv[w + 1] as string, `${md}\n`);
  console.log(md);
}
