import { events } from '../../telemetry/instance';

export const PH_GAME = { id: 'pattern-hunter', version: 'proto-0.1' } as const;

/** Emits one event to the shared, consent-gated, local-only log. Its vocabulary is registered in telemetry/schemas.ts. */
export const emitPh = (challenge: { id: string; version: number }, type: string, payload: Record<string, unknown>): void => void events.emit(PH_GAME, challenge, type, payload);
