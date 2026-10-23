import type { KV } from '../save/store';
import { ENVELOPE_SCHEMA, validateEnvelope } from './envelope';
import type { EventEnvelope } from './envelope';

export const EVENTS_KEY = 'hva.events.v1';
export const MAX_EVENTS = 800;

export interface EventLogDeps {
  kv: KV;
  /** Same consent switch as The Experiment's recorder: one choice for the whole arcade. */
  enabled: () => boolean;
  tick: () => number;
  sessionId: () => string;
}

/**
 * Local-only event log for games that use the neutral envelope. It writes nothing unless the player has opted in, never
 * sends anything anywhere, validates every event on the way in, and is bounded. The session id is created once per visit.
 */
export class EventLog {
  private events: EventEnvelope[] = [];
  private seq = new Map<string, number>();
  private began: number;
  private session: string | null = null;

  constructor(private readonly d: EventLogDeps) {
    this.began = d.tick();
    if (d.enabled()) this.events = this.read();
  }

  get count(): number {
    return this.events.length;
  }

  emit(game: { id: string; version: string }, challenge: { id: string; version: number }, type: string, payload: Record<string, unknown>): boolean {
    if (!this.d.enabled()) return false;
    this.session ??= this.d.sessionId();
    const seq = this.seq.get(this.session) ?? 0;
    const e: EventEnvelope = { schema: ENVELOPE_SCHEMA, game, challenge, session: this.session, type, seq, t: Math.round((this.d.tick() - this.began) / 10) * 10, payload };
    if (!validateEnvelope(e).ok) return false; // a payload that breaks its schema is dropped, never stored
    this.seq.set(this.session, seq + 1);
    this.events.push(e);
    this.events = this.events.slice(-MAX_EVENTS);
    try {
      this.d.kv.setItem(EVENTS_KEY, JSON.stringify({ schema: ENVELOPE_SCHEMA, events: this.events }));
    } catch {
      /* storage blocked or full: keep it in memory for this tab */
    }
    return true;
  }

  all(): EventEnvelope[] {
    return this.d.enabled() ? [...this.events] : [];
  }

  clear(): void {
    this.events = [];
    this.seq.clear();
    try {
      this.d.kv.removeItem(EVENTS_KEY);
    } catch {
      /* nothing to remove */
    }
  }

  private read(): EventEnvelope[] {
    try {
      const raw = this.d.kv.getItem(EVENTS_KEY);
      if (!raw) return [];
      const v = JSON.parse(raw) as { schema?: string; events?: unknown };
      return v.schema === ENVELOPE_SCHEMA && Array.isArray(v.events) ? (v.events as EventEnvelope[]).filter((e) => validateEnvelope(e).ok) : [];
    } catch {
      return [];
    }
  }
}
