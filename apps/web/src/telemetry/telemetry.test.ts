import { describe, expect, it, vi } from 'vitest';
import type { GameAction } from '@hva/game-core';
import { LEVELS, create, hashString, levelById, observe, solve, step } from '@hva/game-core';
import type { KV } from '../save/store';
import { MAX_ATTEMPTS, TelemetryRecorder } from './recorder';
import { CONSENT_KEY, STORE_KEY } from './types';
import { verifyAttempt } from './verify';

const memory = (): KV & { writes: string[]; data: Map<string, string> } => {
  const data = new Map<string, string>();
  const writes: string[] = [];
  return { data, writes, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void (writes.push(k), data.set(k, v)), removeItem: (k) => void data.delete(k) };
};
const make = (kv = memory()) => {
  let t = 0;
  let n = 0;
  const rec = new TelemetryRecorder({ kv, now: () => Date.UTC(2026, 9, 22, 14, 37, 12), tick: () => (t += 137), id: () => `id${(n += 1)}`, appVersion: 'test' });
  return { rec, kv };
};

/** Plays a world through the engine the way the game does, feeding the recorder like the Arena does. */
function play(rec: TelemetryRecorder, levelId: string, actions: GameAction[], opts: { hint?: boolean; end?: boolean } = {}) {
  const level = levelById(levelId)!;
  const s = create(level, 'human-session');
  rec.beginAttempt({ levelId, levelVersion: level.version, startHash: hashString(JSON.stringify(observe(s))), device: 'pointer' });
  actions.forEach((a, i) => {
    if (opts.hint && i === 2) rec.recordHint(1);
    const phase = s.phase;
    const r = step(s, a);
    rec.recordAction({ action: a, phase, events: r.events.map((e) => e.type), hash: hashString(JSON.stringify(observe(s))) });
  });
  if (opts.end !== false) rec.endAttempt({ status: s.status === 'won' ? 'won' : 'lost', runActions: s.runUsed, scoutActions: s.scoutUsed, scoutResets: 0, runResets: 0 });
  return level;
}
const optimal = (id: string): GameAction[] => {
  const l = levelById(id)!;
  return [...(l.budget.explore > 0 ? ([{ type: 'COMMIT' }] as GameAction[]) : []), ...(solve(l).optimalSolution as GameAction[])];
};

describe('consent: off by default, and off means nothing at all', () => {
  it('records nothing and writes nothing to storage until the player opts in', () => {
    const { rec, kv } = make();
    expect(rec.enabled).toBe(false);
    play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    expect(rec.count).toBe(0);
    expect(rec.export().attempts).toEqual([]);
    expect(kv.writes).toEqual([]);
  });

  it('opting in starts recording; opting out erases what was kept', () => {
    const { rec, kv } = make();
    rec.setConsent(true);
    play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    expect(rec.count).toBe(1);
    expect(kv.data.has(STORE_KEY)).toBe(true);
    rec.setConsent(false);
    expect(rec.count).toBe(0);
    expect(kv.data.has(STORE_KEY)).toBe(false);
    play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    expect(rec.count).toBe(0);
  });

  it('consent survives a reload, with the policy wording it was given against and a date only', () => {
    const { rec, kv } = make();
    rec.setConsent(true);
    play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    const again = make(kv).rec;
    expect(again.enabled).toBe(true);
    expect(again.count).toBe(1);
    expect(JSON.parse(kv.data.get(CONSENT_KEY) as string)).toEqual({ granted: true, at: '2026-10-22', policyVersion: 'draft-2' });
  });

  it('consent given under older wording is not honoured: the player is asked again, and nothing is recorded meanwhile', () => {
    const kv = memory();
    kv.setItem(CONSENT_KEY, JSON.stringify({ granted: true, at: '2026-01-01', policyVersion: 'draft-1' }));
    const { rec } = make(kv);
    expect(rec.enabled).toBe(false);
    play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    expect(rec.count).toBe(0);
  });

  it('delete removes the saved attempts but keeps the choice', () => {
    const { rec } = make();
    rec.setConsent(true);
    play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    rec.clear();
    expect(rec.count).toBe(0);
    expect(rec.enabled).toBe(true);
  });

  it('never touches the network', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { rec } = make();
    rec.setConsent(true);
    play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    rec.export();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('what is recorded', () => {
  it('actions, phases, timing, hints and the outcome, with no identity, location or device details', () => {
    const { rec } = make();
    rec.setConsent(true);
    play(rec, 'w02-orange-switch', optimal('w02-orange-switch'), { hint: true });
    const f = rec.export();
    const a = f.attempts[0]!;
    expect(f.schema).toBe('hva.telemetry.1');
    expect(a.levelId).toBe('w02-orange-switch');
    expect(a.levelVersion).toBe(levelById('w02-orange-switch')!.version);
    expect(a.startedAt).toBe('2026-10-22T14:00:00Z'); // rounded down to the hour
    expect(a.actions[0]).toMatchObject({ i: 0, phase: 'explore', a: { type: 'COMMIT' } });
    expect(a.actions.at(-1)!.phase).toBe('execute');
    expect(a.actions.every((x, i) => x.t % 10 === 0 && (i === 0 || x.t >= a.actions[i - 1]!.t))).toBe(true);
    expect(a.hints).toEqual([{ tier: 1, t: expect.any(Number), atAction: 2 }]);
    expect(a.outcome).toMatchObject({ status: 'won', assisted: true });
    const text = JSON.stringify(f);
    expect(text).not.toMatch(/userAgent|navigator|language|timezone|ip|email|name/i);
    expect(Object.keys(a).sort()).toEqual(['actions', 'device', 'hints', 'id', 'levelId', 'levelVersion', 'outcome', 'prefix', 'start', 'startedAt']);
  });

  it('an attempt left unfinished is kept as abandoned (it shows where people stop); one with no action is dropped', () => {
    const { rec } = make();
    rec.setConsent(true);
    const l = levelById('w01-first-steps')!;
    rec.beginAttempt({ levelId: l.id, levelVersion: l.version, startHash: 'x', device: 'touch' });
    rec.abandon();
    expect(rec.count).toBe(0);
    play(rec, 'w01-first-steps', optimal('w01-first-steps').slice(0, 3), { end: false });
    rec.abandon();
    expect(rec.export().attempts[0]!.outcome).toMatchObject({ status: 'abandoned', runActions: 3 });
  });

  it('is bounded: the oldest attempts are dropped past the cap', () => {
    const { rec } = make();
    rec.setConsent(true);
    for (let i = 0; i < MAX_ATTEMPTS + 5; i++) play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    expect(rec.export().attempts.length).toBeLessThanOrEqual(MAX_ATTEMPTS);
  });
});

describe('verification of an exported attempt (it can be replayed, so it cannot be quietly edited)', () => {
  it('a real attempt on every world replays to its recorded observations and outcome', () => {
    const { rec } = make();
    rec.setConsent(true);
    for (const l of LEVELS) play(rec, l.id, optimal(l.id));
    for (const a of rec.export().attempts) expect(verifyAttempt(a, levelById(a.levelId)!), a.levelId).toEqual({ ok: true, errors: [] });
  });

  it('rejects edited actions, edited hashes, a false outcome, and the wrong world version', () => {
    const { rec } = make();
    rec.setConsent(true);
    const level = play(rec, 'w02-orange-switch', optimal('w02-orange-switch'));
    const a = rec.export().attempts[0]!;
    const edited = structuredClone(a);
    edited.actions[3]!.a = { type: 'MOVE', direction: 'UP' };
    expect(verifyAttempt(edited, level).ok).toBe(false);
    const hash = structuredClone(a);
    hash.actions[1]!.h = 'deadbeef';
    expect(verifyAttempt(hash, level).ok).toBe(false);
    const lie = structuredClone(a);
    lie.outcome!.status = 'lost';
    expect(verifyAttempt(lie, level).errors.join()).toContain('outcome says lost');
    expect(verifyAttempt(a, { ...level, version: level.version + 1 }).ok).toBe(false);
  });

  it('a resumed attempt carries the actions the game replayed silently, and still verifies', () => {
    const { rec } = make();
    rec.setConsent(true);
    const level = levelById('w01-first-steps')!;
    const all = optimal('w01-first-steps');
    const s = create(level, 'human-session');
    all.slice(0, 3).forEach((a) => step(s, a));
    rec.beginAttempt({ levelId: level.id, levelVersion: level.version, startHash: hashString(JSON.stringify(observe(s))), device: 'pointer', prefix: all.slice(0, 3) });
    for (const a of all.slice(3)) {
      const phase = s.phase;
      const r = step(s, a);
      rec.recordAction({ action: a, phase, events: r.events.map((e) => e.type), hash: hashString(JSON.stringify(observe(s))) });
    }
    rec.endAttempt({ status: 'won', runActions: 8, scoutActions: 0, scoutResets: 0, runResets: 0 });
    expect(verifyAttempt(rec.export().attempts[0]!, level).ok).toBe(true);
  });
});

describe('the playtest analyser', () => {
  it('summarises verified attempts per world and excludes ones that do not replay', async () => {
    const { analyze } = await import('../../../../tools/analyze-playtest');
    const { rec } = make();
    rec.setConsent(true);
    play(rec, 'w01-first-steps', optimal('w01-first-steps'));
    play(rec, 'w01-first-steps', optimal('w01-first-steps'), { hint: true });
    const file = rec.export();
    const forged = structuredClone(file);
    forged.attempts[0]!.actions[2]!.h = 'bad';
    const md = analyze([{ name: 'a.json', data: file }, { name: 'forged.json', data: forged }]);
    expect(md).toContain('Players (files): 2. Attempts that replay cleanly: 3. Excluded: 1.');
    expect(md).toMatch(/\| 1 \| First Steps \| 2 \| 3 \| 100% \|/);
    expect(md).toContain('forged.json');
  });
});
