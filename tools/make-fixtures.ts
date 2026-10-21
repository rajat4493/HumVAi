// Generates REFERENCE-PLAYER fixtures for development, tests and screenshots of the rivalry UI.
// These are computed/scripted players, never AI models; every file says so and the UI labels them
// "Reference solver (not an AI)". They are loaded only with ?fixtures=1 and are verified like real recordings.
import { mkdirSync, writeFileSync } from 'node:fs';
import { LEVELS, solve } from '@hva/game-core';
import type { ChallengeDefinition, GameAction } from '@hva/game-core';
import { buildOpponent, checkOpponent, randomLegalAdapter, runAttempt, scriptedAdapter } from '@hva/ai-adapters';
import type { OpponentRecording, RunRecord } from '@hva/ai-adapters';

const OUT = new URL('../apps/web/public/fixtures/recordings/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const NOW = new Date('2026-01-01T00:00:00Z');

async function attempt(level: ChallengeDefinition, adapter: ReturnType<typeof scriptedAdapter>, n: number): Promise<RunRecord> {
  const { record } = await runAttempt({ attemptId: `${level.id}@${level.version}/reference/a${n}`, seed: `fixture-${n}`, level, adapter, configHash: 'fixture', promptHash: 'fixture', runnerVersion: 'fixture', engineVersion: 'fixture', now: () => NOW });
  return record;
}

const index: { challengeId: string; file: string }[] = [];
for (const level of LEVELS) {
  const optimal = solve(level).optimalSolution as GameAction[];
  const slack = level.budget.execute - optimal.length;
  const plan = [...(level.budget.explore > 0 ? ([{ type: 'COMMIT' }] as GameAction[]) : []), ...optimal];
  const commitAt = plan.findIndex((a) => a.type === 'COMMIT');
  const records: RunRecord[] = [];
  // seven wins of varying efficiency (each wasted action is a bump into the top wall), then three random-legal attempts
  const extras = [0, 0, 1, 1, 2, 2, 3].map((e) => Math.min(e, slack));
  for (const [i, extra] of extras.entries()) {
    const bumps: GameAction[] = Array.from({ length: extra }, () => ({ type: 'MOVE', direction: 'UP' }) as GameAction);
    const actions = commitAt >= 0 ? [...plan.slice(0, commitAt + 1), ...bumps, ...plan.slice(commitAt + 1)] : [...bumps, ...plan];
    records.push(await attempt(level, scriptedAdapter(actions), i + 1));
  }
  for (let i = 0; i < 3; i++) records.push(await attempt(level, randomLegalAdapter(100 + i), 8 + i));
  const o = buildOpponent(records, level, { kind: 'reference', now: NOW }) as OpponentRecording;
  const check = checkOpponent(o, level);
  if (!check.ok) throw new Error(`${level.id}: ${check.errors.join('; ')}`);
  const file = `${level.id}.json`;
  writeFileSync(`${OUT}${file}`, `${JSON.stringify(o)}\n`);
  index.push({ challengeId: level.id, file });
  console.log(`${level.id}: ${o.attempts.filter((a) => a.status === 'won').length}/${o.attempts.length} reached the exit; shown attempt ${o.shownAttempt} (${o.shown.outcome.runActions} run actions, ${o.selection})`);
}
writeFileSync(`${OUT}index.json`, `${JSON.stringify({ schema: 'hva.recordings.1', recordings: index }, null, 2)}\n`);
