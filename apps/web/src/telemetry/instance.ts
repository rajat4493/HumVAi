import { useSyncExternalStore } from 'react';
import { pickStorage } from '../save/store';
import { attemptToEnvelopes, validateEnvelope } from './envelope';
import './schemas';
import type { EventEnvelope } from './envelope';
import { EventLog } from './eventlog';
import { TelemetryRecorder } from './recorder';

declare const __APP_VERSION__: string;

const { kv } = pickStorage(() => (typeof localStorage === 'undefined' ? undefined : localStorage));
const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

/** One recorder per tab; it does nothing until the player turns it on in Settings. */
export const telemetry = new TelemetryRecorder({
  kv,
  now: () => Date.now(),
  tick: () => performance.now(),
  id: () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `a${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`),
  appVersion: version,
});

/** Neutral event log for games that use the shared envelope (Pattern Hunter). Same consent, same delete button. */
export const events = new EventLog({
  kv,
  enabled: () => telemetry.enabled,
  tick: () => performance.now(),
  sessionId: () => `s-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`.slice(0, 24),
});
telemetry.onClear(() => events.clear());

// Persist an unfinished attempt if the tab is closed or hidden.
if (typeof window !== 'undefined') {
  const leave = () => telemetry.abandon();
  window.addEventListener('pagehide', leave);
}

export function useTelemetry(): { enabled: boolean; count: number; events: number } {
  const key = useSyncExternalStore(telemetry.subscribe, () => `${telemetry.enabled ? 1 : 0}:${telemetry.count}:${events.count}`);
  const [e, c, n] = key.split(':');
  return { enabled: e === '1', count: Number(c), events: Number(n) };
}

/** The neutral export: Experiment attempts turned into envelopes, plus every other game's events. Local file only. */
export function neutralExport(): { schema: 'hva.events.1'; exportedAt: string; dropped: number; events: EventEnvelope[] } {
  const mine = telemetry.export().attempts.flatMap((a) => attemptToEnvelopes(a, `s-${a.id.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 18)}`));
  const all = [...mine, ...events.all()];
  const good = all.filter((e) => validateEnvelope(e).ok);
  return { schema: 'hva.events.1', exportedAt: new Date().toISOString().slice(0, 10), dropped: all.length - good.length, events: good };
}
