// Fails the build if any shipped opponent recording cannot be replay-verified or is mislabelled.
//  - public/recordings/            (what players see): ONLY real model recordings (kind "model")
//  - public/fixtures/recordings/   (dev/tests, ?fixtures=1): ONLY reference players (kind "reference")
import { existsSync, readFileSync } from 'node:fs';
import { LEVELS } from '@hva/game-core';
import { checkOpponent } from '@hva/ai-adapters';
import type { OpponentRecording } from '@hva/ai-adapters';

const base = new URL('../apps/web/public/', import.meta.url).pathname;
let bad = 0;
let total = 0;
for (const [dir, expectKind] of [['recordings', 'model'], ['fixtures/recordings', 'reference']] as const) {
  const idx = `${base}${dir}/index.json`;
  if (!existsSync(idx)) {
    console.log(`${dir}: no index.json (nothing shipped)`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(idx, 'utf8')) as { schema: string; recordings: { challengeId: string; file: string }[] };
  if (manifest.schema !== 'hva.recordings.1') {
    console.error(`FAIL ${dir}/index.json: unknown schema`);
    bad++;
    continue;
  }
  for (const entry of manifest.recordings) {
    total++;
    const level = LEVELS.find((l) => l.id === entry.challengeId);
    const rec = JSON.parse(readFileSync(`${base}${dir}/${entry.file}`, 'utf8')) as OpponentRecording;
    const errors = level ? checkOpponent(rec, level).errors : ['unknown world'];
    if (rec.kind !== expectKind) errors.push(`${dir} may only contain kind "${expectKind}", found "${rec.kind}"`);
    if (expectKind === 'model' && rec.shown?.model?.provider === 'test') errors.push('test/scripted records cannot be shipped as AI recordings');
    if (errors.length) {
      console.error(`FAIL ${dir}/${entry.file}: ${errors.join('; ')}`);
      bad++;
    } else console.log(`OK   ${dir}/${entry.file} (${rec.kind}, ${rec.model.displayName})`);
  }
}
console.log(`${total - bad}/${total} recordings verified`);
process.exit(bad === 0 ? 0 : 1);
