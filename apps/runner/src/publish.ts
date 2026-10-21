import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEVELS } from '@hva/game-core';
import { buildOpponent, checkOpponent, verifyRecord } from '@hva/ai-adapters';
import type { RunRecord } from '@hva/ai-adapters';

export interface PublishResult {
  written: string[];
  refused: string[];
}

/**
 * Turns verified run records of ONE model into the static recordings the game ships.
 * Only real model records can be published: provider "test" (scripted/random/reference players) is refused,
 * every attempt must replay-verify, and the result must pass the same check the browser applies on load.
 */
export function publishRecordings(records: RunRecord[], opts: { provider: string; modelId: string; to: string; now?: Date }): PublishResult {
  const now = opts.now ?? new Date();
  const result: PublishResult = { written: [], refused: [] };
  if (opts.provider === 'test') {
    result.refused.push('provider "test" (scripted, random or reference players) cannot be published as AI recordings');
    return result;
  }
  mkdirSync(opts.to, { recursive: true });
  const indexPath = join(opts.to, 'index.json');
  const manifest = existsSync(indexPath) ? (JSON.parse(readFileSync(indexPath, 'utf8')) as { schema: string; recordings: { challengeId: string; file: string }[] }) : { schema: 'hva.recordings.1', recordings: [] };

  const mine = records.filter((r) => r.model.provider === opts.provider && r.model.modelId === opts.modelId);
  for (const level of LEVELS) {
    const forLevel = mine.filter((r) => r.challengeId === level.id && r.challengeVersion === level.version && r.outcome.status !== 'void');
    if (forLevel.length === 0) continue;
    const configs = new Set(forLevel.map((r) => r.configHash));
    if (configs.size > 1) {
      result.refused.push(`${level.id}: records come from ${configs.size} different configurations; publish one configuration at a time`);
      continue;
    }
    const unverified = forLevel.filter((r) => !verifyRecord(r, level).ok);
    if (unverified.length > 0) {
      result.refused.push(`${level.id}: ${unverified.length} record(s) failed replay verification (${unverified[0]?.attemptId})`);
      continue;
    }
    const rec = buildOpponent(forLevel, level, { kind: 'model', now });
    if (!rec) {
      result.refused.push(`${level.id}: no usable attempt`);
      continue;
    }
    const check = checkOpponent(rec, level);
    if (!check.ok) {
      result.refused.push(`${level.id}: ${check.errors.join('; ')}`);
      continue;
    }
    const file = `${level.id}.json`;
    writeFileSync(join(opts.to, file), `${JSON.stringify(rec)}\n`);
    manifest.recordings = [...manifest.recordings.filter((e) => e.challengeId !== level.id), { challengeId: level.id, file }];
    result.written.push(file);
  }
  writeFileSync(indexPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return result;
}
