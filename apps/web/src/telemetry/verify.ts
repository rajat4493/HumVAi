import type { ChallengeDefinition } from '@hva/game-core';
import { create, hashString, observe, step } from '@hva/game-core';
import type { TAttempt } from './types';

/**
 * Proves an exported attempt is internally consistent: replaying its actions through the engine reproduces every
 * observation hash and the recorded outcome. Anything edited, truncated or from another world version fails.
 */
export function verifyAttempt(a: TAttempt, level: ChallengeDefinition): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (level.id !== a.levelId || level.version !== a.levelVersion) return { ok: false, errors: [`attempt is for ${a.levelId}@${a.levelVersion}, not ${level.id}@${level.version}`] };
  const s = create(level, 'human-session');
  for (const p of a.prefix) step(s, p);
  if (hashString(JSON.stringify(observe(s))) !== a.start) errors.push('start observation hash differs');
  let prev = -1;
  a.actions.forEach((x, n) => {
    if (x.i !== n) errors.push(`action ${n}: index says ${x.i}`);
    if (x.t < prev) errors.push(`action ${n}: time goes backwards`);
    prev = x.t;
    if (x.phase !== s.phase) errors.push(`action ${n}: phase ${x.phase} but the engine is in ${s.phase}`);
    const r = step(s, x.a);
    if (!r.valid) errors.push(`action ${n}: the engine rejects it`);
    if (JSON.stringify(r.events.map((e) => e.type)) !== JSON.stringify(x.ev)) errors.push(`action ${n}: events differ`);
    if (hashString(JSON.stringify(observe(s))) !== x.h) errors.push(`action ${n}: observation hash differs`);
  });
  if (a.outcome && a.outcome.status !== 'abandoned') {
    const won = s.status === 'won';
    if ((a.outcome.status === 'won') !== won) errors.push(`outcome says ${a.outcome.status} but the replay ends ${s.status}`);
  }
  return { ok: errors.length === 0, errors };
}
