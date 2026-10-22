import { useSyncExternalStore } from 'react';
import { pickStorage } from '../save/store';
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

// Persist an unfinished attempt if the tab is closed or hidden.
if (typeof window !== 'undefined') {
  const leave = () => telemetry.abandon();
  window.addEventListener('pagehide', leave);
}

export function useTelemetry(): { enabled: boolean; count: number } {
  const key = useSyncExternalStore(telemetry.subscribe, () => `${telemetry.enabled ? 1 : 0}:${telemetry.count}`);
  const [e, c] = key.split(':');
  return { enabled: e === '1', count: Number(c) };
}
