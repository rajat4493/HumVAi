import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CallLog, RunRecord } from '@hva/ai-adapters';

export function appendJsonl(path: string, obj: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(obj)}\n`);
}

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

export const paths = (dir: string) => ({
  records: `${dir}/records.jsonl`,
  calls: `${dir}/calls.jsonl`,
  meta: `${dir}/meta.jsonl`,
});

export function saveAttempt(dir: string, record: RunRecord, logs: CallLog[], verified: { ok: boolean; errors: string[] }): void {
  const p = paths(dir);
  appendJsonl(p.records, record);
  for (const l of logs) appendJsonl(p.calls, l);
  appendJsonl(p.meta, { attemptId: record.attemptId, verified: verified.ok, verifyErrors: verified.errors, savedAt: new Date().toISOString() });
}
