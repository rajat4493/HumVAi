import type { TAttempt } from './types';

/**
 * The game-neutral event envelope. Every game's evidence is wrapped the same way; what goes in `payload` is defined and
 * validated per game and per event type. Nothing here records who the player is: the session id is random and lasts for
 * one visit, and payloads may only contain numbers, booleans and short identifier-like strings, so free text (and with it
 * names, emails or anything typed) cannot enter by construction.
 */
export const ENVELOPE_SCHEMA = 'hva.event.1';

export interface EventEnvelope {
  schema: typeof ENVELOPE_SCHEMA;
  game: { id: string; version: string };
  challenge: { id: string; version: number };
  /** Random per visit; never stored across visits and never linked to a person or device. */
  session: string;
  type: string;
  /** 0, 1, 2 ... within the session */
  seq: number;
  /** Milliseconds since the session began, rounded to 10 ms. */
  t: number;
  payload: Record<string, unknown>;
}

/** A payload validator returns null when the payload is acceptable, or a reason when it is not. */
export type PayloadValidator = (payload: Record<string, unknown>) => string | null;
export type GameSchema = Record<string, PayloadValidator>;

const registry = new Map<string, GameSchema>();
export const registerGameSchema = (gameId: string, schema: GameSchema): void => void registry.set(gameId, schema);

// Building blocks for payload validators. `id` is deliberately narrow: lowercase letters, digits, dash and underscore.
export const v = {
  int: (x: unknown): boolean => typeof x === 'number' && Number.isInteger(x) && Math.abs(x) < 1e9,
  bool: (x: unknown): boolean => typeof x === 'boolean',
  id: (x: unknown): boolean => typeof x === 'string' && /^[a-z0-9_-]{1,40}$/.test(x),
  oneOf:
    (...allowed: string[]) =>
    (x: unknown): boolean =>
      typeof x === 'string' && allowed.includes(x),
  intList:
    (max: number) =>
    (x: unknown): boolean =>
      Array.isArray(x) && x.length <= max && x.every((n) => v.int(n)),
  idList:
    (max: number) =>
    (x: unknown): boolean =>
      Array.isArray(x) && x.length <= max && x.every((s) => v.id(s)),
};

/** Builds a validator from a field table; unknown fields are rejected, so a payload cannot smuggle extra data. */
export const shape =
  (fields: Record<string, (x: unknown) => boolean>): PayloadValidator =>
  (p) => {
    for (const k of Object.keys(p)) if (!(k in fields)) return `unexpected field "${k}"`;
    for (const [k, ok] of Object.entries(fields)) if (!ok(p[k])) return `field "${k}" is missing or has the wrong type`;
    return null;
  };

export function validateEnvelope(e: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const x = e as Partial<EventEnvelope> | null;
  if (typeof x !== 'object' || x === null) return { ok: false, errors: ['not an object'] };
  if (x.schema !== ENVELOPE_SCHEMA) errors.push('unknown schema');
  if (!x.game || !v.id(x.game.id) || typeof x.game.version !== 'string' || !/^[a-z0-9._-]{1,24}$/.test(x.game.version)) errors.push('bad game');
  if (!x.challenge || !v.id(x.challenge.id) || !v.int(x.challenge.version)) errors.push('bad challenge');
  if (typeof x.session !== 'string' || !/^s-[a-z0-9]{6,24}$/.test(x.session)) errors.push('bad session id');
  if (typeof x.type !== 'string' || !/^[a-z_]{1,32}$/.test(x.type)) errors.push('bad event type');
  if (!v.int(x.seq) || (x.seq as number) < 0) errors.push('bad sequence number');
  if (!v.int(x.t) || (x.t as number) < 0) errors.push('bad timestamp');
  if (typeof x.payload !== 'object' || x.payload === null || Array.isArray(x.payload)) errors.push('payload must be an object');
  if (errors.length === 0 && x.game && x.type && x.payload) {
    const schema = registry.get(x.game.id);
    const check = schema?.[x.type];
    if (!schema) errors.push(`no schema registered for game "${x.game.id}"`);
    else if (!check) errors.push(`unknown event type "${x.type}" for ${x.game.id}`);
    else {
      const why = check(x.payload as Record<string, unknown>);
      if (why) errors.push(`payload: ${why}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Is the sequence a clean 0..n-1 run per session, with time never going backwards? */
export function checkSequence(events: EventEnvelope[]): string[] {
  const problems: string[] = [];
  const bySession = new Map<string, EventEnvelope[]>();
  for (const e of events) bySession.set(e.session, [...(bySession.get(e.session) ?? []), e]);
  for (const [s, list] of bySession) {
    list.forEach((e, i) => {
      if (e.seq !== i) problems.push(`${s}: expected seq ${i}, got ${e.seq}`);
      if (i > 0 && e.t < (list[i - 1] as EventEnvelope).t) problems.push(`${s}: time goes backwards at seq ${e.seq}`);
    });
  }
  return problems;
}

// ---- The Experiment's schema (its recorder keeps its own richer, replay-verifiable format; this is the neutral view) ----
export const EXPERIMENT_GAME = { id: 'experiment', version: 'campaign-1' } as const;
const phase = v.oneOf('explore', 'execute');
registerGameSchema('experiment', {
  attempt_start: shape({ device: v.oneOf('touch', 'pointer'), resumed: v.bool }),
  action: shape({ phase, kind: v.oneOf('MOVE', 'INTERACT', 'RESET', 'COMMIT'), events: v.idList(12) }),
  hint: shape({ tier: v.int, at_action: v.int }),
  outcome: shape({ status: v.oneOf('won', 'lost', 'abandoned'), run_actions: v.int, scout_actions: v.int, scout_resets: v.int, run_resets: v.int, assisted: v.bool }),
});

/** Derives the neutral events for one recorded Experiment attempt. Pure; the attempt itself is untouched. */
export function attemptToEnvelopes(a: TAttempt, session: string): EventEnvelope[] {
  const out: EventEnvelope[] = [];
  const push = (type: string, t: number, payload: Record<string, unknown>) =>
    out.push({ schema: ENVELOPE_SCHEMA, game: { ...EXPERIMENT_GAME }, challenge: { id: a.levelId, version: a.levelVersion }, session, type, seq: out.length, t, payload });
  push('attempt_start', 0, { device: a.device, resumed: a.prefix.length > 0 });
  const timeline = [
    ...a.actions.map((x) => ({ t: x.t, order: 1, run: () => push('action', x.t, { phase: x.phase, kind: x.a.type, events: x.ev.map((e) => e.toLowerCase().replace(/[^a-z0-9_-]/g, '-')).slice(0, 12) }) })),
    ...a.hints.map((h) => ({ t: h.t, order: 0, run: () => push('hint', h.t, { tier: h.tier, at_action: h.atAction }) })),
  ].sort((p, q) => p.t - q.t || p.order - q.order);
  for (const e of timeline) e.run();
  if (a.outcome) {
    const o = a.outcome;
    push('outcome', o.durationMs, { status: o.status, run_actions: o.runActions, scout_actions: o.scoutActions, scout_resets: o.scoutResets, run_resets: o.runResets, assisted: o.assisted });
  }
  return out;
}
