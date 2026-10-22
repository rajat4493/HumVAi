import type { ChallengeDefinition } from '@hva/game-core';
import { checkOpponent } from '@hva/ai-adapters';
import type { OpponentRecording } from '@hva/ai-adapters';

export type OpponentState =
  | { kind: 'loading' }
  /** No recording exists for this world (the honest default until real model runs exist). */
  | { kind: 'none' }
  /** A recording exists but cannot be used: wrong world version, failed replay verification, bad label. Never scored. */
  | { kind: 'unusable'; reason: string }
  | { kind: 'ready'; rec: OpponentRecording };

interface Manifest {
  schema: string;
  recordings: { challengeId: string; file: string }[];
}

const baseUrl = (): string => (typeof import.meta !== 'undefined' ? (import.meta.env.BASE_URL ?? '/') : '/');

/**
 * Loads the static recording for a world and re-verifies it in the browser before it can be shown:
 * the shown attempt is replayed through the engine, the label and selection rule are checked.
 * `fixtures` loads the reference-player fixtures (development and tests only; opt-in via ?fixtures=1).
 */
export async function loadOpponent(level: ChallengeDefinition, opts: { fixtures: boolean; base?: string; fetchFn?: typeof fetch } = { fixtures: false }): Promise<OpponentState> {
  const f = opts.fetchFn ?? fetch;
  const dir = `${opts.base ?? baseUrl()}${opts.fixtures ? 'fixtures/recordings' : 'recordings'}`;
  try {
    const res = await f(`${dir}/index.json`);
    if (!res.ok) return { kind: 'none' };
    const manifest = (await res.json()) as Manifest;
    if (manifest.schema !== 'hva.recordings.1') return { kind: 'none' };
    const entry = manifest.recordings.find((r) => r.challengeId === level.id);
    if (!entry) return { kind: 'none' };
    const file = await f(`${dir}/${entry.file}`);
    if (!file.ok) return { kind: 'none' };
    const rec = (await file.json()) as OpponentRecording;
    const check = checkOpponent(rec, level);
    if (!check.ok) return { kind: 'unusable', reason: check.errors[0] ?? 'failed verification' };
    // Real recordings may only ever be models; fixtures may only ever be reference players.
    if (opts.fixtures ? rec.kind !== 'reference' : rec.kind !== 'model') return { kind: 'unusable', reason: 'recording kind does not match where it was loaded from' };
    return { kind: 'ready', rec };
  } catch {
    return { kind: 'none' };
  }
}

/** How many worlds have a recorded model attempt available (0 until real recordings are published). Never throws. */
export async function countRecordedWorlds(opts: { base?: string; fetchFn?: typeof fetch } = {}): Promise<number> {
  const f = opts.fetchFn ?? fetch;
  try {
    const res = await f(`${opts.base ?? baseUrl()}recordings/index.json`);
    if (!res.ok) return 0;
    const manifest = (await res.json()) as Manifest;
    return manifest.schema === 'hva.recordings.1' ? manifest.recordings.length : 0;
  } catch {
    return 0;
  }
}
