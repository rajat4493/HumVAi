import { events } from '../../telemetry/instance';

export const DPT_GAME = { id: 'dont-press-that', version: 'slice-0.1' } as const;

/** One event to the shared, consent-gated, local-only log. Its vocabulary is registered in telemetry/schemas.ts. */
export const emitDpt = (level: { id: string; version: number }, type: string, payload: Record<string, unknown>): void => void events.emit(DPT_GAME, { id: level.id, version: level.version }, type, payload);
