import { describe, expect, it } from 'vitest';
import { LEVELS, create, hashString, observe, solve, step } from '@hva/game-core';
import type { GameAction } from '@hva/game-core';
import type { KV } from '../save/store';
import { ENVELOPE_SCHEMA, attemptToEnvelopes, checkSequence, validateEnvelope } from './envelope';
import type { EventEnvelope } from './envelope';
import { EVENTS_KEY, EventLog, MAX_EVENTS } from './eventlog';
import { TelemetryRecorder } from './recorder';
import './schemas';

const PH = { id: 'pattern-hunter', version: 'proto-0.1' };
const ch = { id: 'ph-001', version: 1 };
const base = (over: Partial<EventEnvelope> = {}): EventEnvelope => ({ schema: ENVELOPE_SCHEMA, game: PH, challenge: ch, session: 's-abc123def4', type: 'probe', seq: 0, t: 0, payload: { n: 7, fits: false, probes_left: 5 }, ...over });

describe('the neutral envelope', () => {
  it('accepts a well-formed event for a registered game', () => {
    expect(validateEnvelope(base())).toEqual({ ok: true, errors: [] });
  });

  it.each([
    ['an unknown schema version', { schema: 'hva.event.9' as never }, 'unknown schema'],
    ['a game nobody registered', { game: { id: 'detective', version: '0.1' } }, 'no schema registered'],
    ['an event type the game does not define', { type: 'teleport' }, 'unknown event type'],
    ['a free-text session id (could carry a name)', { session: 'Alice Smith' }, 'bad session id'],
    ['a negative sequence number', { seq: -1 }, 'bad sequence number'],
    ['a payload with an extra field', { payload: { n: 7, fits: false, probes_left: 5, note: 'hi' } }, 'unexpected field'],
    ['a payload with free text where a number belongs', { payload: { n: 'seven', fits: false, probes_left: 5 } }, 'wrong type'],
    ['a missing payload field', { payload: { n: 7, fits: false } }, 'missing'],
    ['a fractional number', { payload: { n: 7.5, fits: false, probes_left: 5 } }, 'wrong type'],
  ])('rejects %s', (_, over, why) => {
    const r = validateEnvelope(base(over as Partial<EventEnvelope>));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain(why);
  });

  it('no payload field can hold free text: strings are limited to enumerations and short ids', () => {
    // the Experiment's `events` list is the only string-bearing field in the shipped vocabularies; spaces and prose fail
    const exp = (events: unknown[]) =>
      validateEnvelope({ ...base(), game: { id: 'experiment', version: 'campaign-1' }, type: 'action', payload: { phase: 'explore', kind: 'MOVE', events } });
    expect(exp(['moved']).ok).toBe(true);
    expect(exp(['my name is Alice']).ok).toBe(false);
    expect(exp(['a@b.com']).ok).toBe(false);
  });

  it('checks a clean sequence per session, and flags gaps and time going backwards', () => {
    const ok = [base({ seq: 0, t: 0 }), base({ seq: 1, t: 10 })];
    expect(checkSequence(ok)).toEqual([]);
    expect(checkSequence([base({ seq: 0 }), base({ seq: 2 })])[0]).toContain('expected seq 1');
    expect(checkSequence([base({ seq: 0, t: 50 }), base({ seq: 1, t: 10 })])[0]).toContain('backwards');
  });
});

describe('The Experiment, seen through the envelope (derived, nothing stored twice)', () => {
  it('a real attempt becomes a valid, ordered event stream that ends in its outcome', () => {
    const mem = new Map<string, string>();
    const kv: KV = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
    let t = 0;
    const rec = new TelemetryRecorder({ kv, now: () => 0, tick: () => (t += 111), id: () => 'attempt1', appVersion: 't' });
    rec.setConsent(true);
    const level = LEVELS[1]!;
    const s = create(level, 'human-session');
    rec.beginAttempt({ levelId: level.id, levelVersion: level.version, startHash: hashString(JSON.stringify(observe(s))), device: 'pointer' });
    const plan: GameAction[] = [{ type: 'COMMIT' }, ...(solve(level).optimalSolution as GameAction[])];
    plan.forEach((a, i) => {
      if (i === 2) rec.recordHint(1);
      const phase = s.phase;
      const r = step(s, a);
      rec.recordAction({ action: a, phase, events: r.events.map((e) => e.type), hash: hashString(JSON.stringify(observe(s))) });
    });
    rec.endAttempt({ status: 'won', runActions: 9, scoutActions: 0, scoutResets: 0, runResets: 0 });
    const events = attemptToEnvelopes(rec.export().attempts[0]!, 's-attempt1xx');
    expect(events[0]!.type).toBe('attempt_start');
    expect(events.at(-1)!.type).toBe('outcome');
    expect(events.filter((e) => e.type === 'action')).toHaveLength(plan.length);
    expect(events.filter((e) => e.type === 'hint')).toHaveLength(1);
    for (const e of events) expect(validateEnvelope(e), JSON.stringify(e)).toEqual({ ok: true, errors: [] });
    expect(checkSequence(events)).toEqual([]);
  });
});

describe('the local event log', () => {
  const make = (enabled = true) => {
    const mem = new Map<string, string>();
    const writes: string[] = [];
    const kv: KV = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void (writes.push(k), mem.set(k, v)), removeItem: (k) => void mem.delete(k) };
    let on = enabled;
    let t = 0;
    const log = new EventLog({ kv, enabled: () => on, tick: () => (t += 37), sessionId: () => 's-testsession1' });
    return { log, mem, writes, setOn: (v: boolean) => void (on = v) };
  };
  const probe = (log: EventLog, n = 7) => log.emit(PH, ch, 'probe', { n, fits: false, probes_left: 5 });

  it('writes nothing, and returns nothing, without consent', () => {
    const { log, writes } = make(false);
    expect(probe(log)).toBe(false);
    expect(writes).toEqual([]);
    expect(log.all()).toEqual([]);
  });

  it('with consent: stores valid events with a per-session sequence and rounded time, and drops invalid ones', () => {
    const { log, mem } = make();
    expect(probe(log)).toBe(true);
    expect(probe(log, 8)).toBe(true);
    expect(log.emit(PH, ch, 'probe', { n: 'free text', fits: false, probes_left: 5 })).toBe(false);
    const stored = JSON.parse(mem.get(EVENTS_KEY) as string).events as EventEnvelope[];
    expect(stored.map((e) => e.seq)).toEqual([0, 1]);
    expect(stored.every((e) => e.t % 10 === 0)).toBe(true);
    expect(log.count).toBe(2);
  });

  it('is bounded, survives a reload, and filters anything that no longer validates', () => {
    const { log, mem } = make();
    for (let i = 0; i < MAX_EVENTS + 20; i++) probe(log, (i % 40) + 1);
    expect(log.count).toBe(MAX_EVENTS);
    const raw = JSON.parse(mem.get(EVENTS_KEY) as string) as { schema: string; events: unknown[] };
    raw.events.push({ nonsense: true });
    mem.set(EVENTS_KEY, JSON.stringify(raw));
    const reloaded = new EventLog({ kv: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) }, enabled: () => true, tick: () => 0, sessionId: () => 's-another1234' });
    expect(reloaded.count).toBe(MAX_EVENTS);
  });

  it('clear erases the stored events; turning consent off hides them', () => {
    const { log, mem, setOn } = make();
    probe(log);
    setOn(false);
    expect(log.all()).toEqual([]);
    log.clear();
    expect(mem.has(EVENTS_KEY)).toBe(false);
  });
});
