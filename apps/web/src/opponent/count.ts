import { baseUrl } from './base';

interface Manifest {
  schema: string;
  recordings: { challengeId: string; file: string }[];
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
