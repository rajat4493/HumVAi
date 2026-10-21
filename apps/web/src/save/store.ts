import { parseSave, parseSession } from './save';
import { SAVE_KEY, SESSION_KEY } from './types';
import type { SaveData, Session } from './types';

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** localStorage when it works (it throws in some private/blocked modes), otherwise memory for this tab. */
export function pickStorage(candidate: () => KV | undefined): { kv: KV; persistent: boolean } {
  try {
    const s = candidate();
    if (s) {
      s.setItem('hva.probe', '1');
      s.removeItem('hva.probe');
      return { kv: s, persistent: true };
    }
  } catch {
    /* fall through to memory */
  }
  const m = new Map<string, string>();
  return { kv: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }, persistent: false };
}

/** Observable save with safe writes: a failed write keeps the in-memory state and never throws into the game. */
export class SaveStore {
  private data: SaveData;
  private listeners = new Set<() => void>();
  readonly persistent: boolean;
  private readonly kv: KV;

  constructor(candidate: () => KV | undefined = () => (typeof localStorage === 'undefined' ? undefined : localStorage)) {
    const { kv, persistent } = pickStorage(candidate);
    this.kv = kv;
    this.persistent = persistent;
    let raw: string | null = null;
    try {
      raw = kv.getItem(SAVE_KEY);
    } catch {
      raw = null;
    }
    this.data = parseSave(raw);
  }

  get = (): SaveData => this.data;

  set(next: SaveData): void {
    this.data = next;
    try {
      this.kv.setItem(SAVE_KEY, JSON.stringify(next));
    } catch {
      /* quota or blocked: keep playing from memory */
    }
    this.listeners.forEach((l) => l());
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSession(): Session | null {
    try {
      return parseSession(this.kv.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  }

  setSession(s: Session): void {
    try {
      this.kv.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  clearSession(): void {
    try {
      this.kv.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Forget all progress and any run in progress. */
  reset(): void {
    this.clearSession();
    this.set(parseSave(null));
  }
}
