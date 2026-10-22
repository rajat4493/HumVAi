import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@hva/game-core';
import { LEVELS, create, step } from '@hva/game-core';
import type { CueId } from './cues';
import { cuesForEvents } from './cues';
import { AudioEngine, CUES, dbToGain, masterGain } from './engine';
import type { CtxLike, GainLike, OscLike, ParamLike } from './engine';

const ALL_CUES = Object.keys(CUES) as CueId[];

function fakeCtx() {
  const log = { oscillators: 0, gains: [] as number[], masterSets: [] as number[], resumed: 0, suspended: 0, noise: 0, maxStop: 0 };
  const param = (sink?: (v: number) => void): ParamLike => ({
    value: 0,
    setValueAtTime: (v: number) => sink?.(v),
    linearRampToValueAtTime: (v: number) => sink?.(v),
    exponentialRampToValueAtTime: (v: number) => sink?.(v),
    cancelScheduledValues: () => undefined,
  });
  const node = () => ({ connect: (n: unknown) => n });
  let gainCount = 0;
  const ctx: CtxLike & { log: typeof log } = {
    log,
    currentTime: 0,
    state: 'suspended',
    destination: {},
    sampleRate: 8000,
    resume: async () => { log.resumed++; ctx.state = 'running'; },
    suspend: async () => { log.suspended++; ctx.state = 'suspended'; },
    createOscillator: (): OscLike => { log.oscillators++; return { ...node(), type: 'sine', frequency: param(), start: () => undefined, stop: (t: number) => { log.maxStop = Math.max(log.maxStop, t); } }; },
    createGain: (): GainLike => { const idx = gainCount++; return { ...node(), gain: param((v) => { log.gains.push(v); if (idx === 0) log.masterSets.push(v); }) }; },
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param(), Q: { value: 0 } }),
    createBuffer: (_c: number, len: number) => { log.noise++; return { getChannelData: () => new Float32Array(len) }; },
    createBufferSource: () => ({ ...node(), buffer: null, start: () => undefined, stop: () => undefined }),
  };
  return ctx;
}
const timers = () => {
  const fns: (() => void)[] = [];
  return { set: (fn: () => void) => { fns.push(fn); return fns.length as unknown as ReturnType<typeof setInterval>; }, clear: () => { fns.length = 0; }, fns };
};

describe('cue table', () => {
  it('defines every cue with a safe level and a duration under 1.2 s', () => {
    for (const id of ALL_CUES) {
      const c = CUES[id];
      expect(c.db, id).toBeLessThanOrEqual(-14);
      expect(c.voices.length, id).toBeGreaterThan(0);
      for (const v of c.voices) expect(v.at + v.dur, id).toBeLessThanOrEqual(1.2);
      for (const v of c.voices) expect(v.g, id).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the loudest possible output below -6 dBFS: master headroom x loudest cue x summed voice peaks', () => {
    for (const id of ALL_CUES) {
      const voices = CUES[id].voices;
      const sumPeak = voices.reduce((a, v) => a + v.g, 0) + (CUES[id].noise?.g ?? 0);
      const peak = masterGain(1) * dbToGain(CUES[id].db) * sumPeak;
      expect(20 * Math.log10(peak), id).toBeLessThan(-6);
    }
  });

  it('the AI replay tick is quieter than every human action cue', () => {
    for (const id of ['step', 'bump', 'push', 'switch_on', 'door_open'] as CueId[]) expect(CUES.ai_step.db).toBeLessThan(CUES[id].db);
  });
});

describe('audio engine', () => {
  const make = () => {
    const ctx = fakeCtx();
    const t = timers();
    const engine = new AudioEngine(() => ctx, t.set, t.clear);
    return { ctx, t, engine };
  };

  it('is completely silent and creates nothing before the first user gesture', () => {
    const { ctx, engine } = make();
    engine.setSettings({ sound: true, music: true, volume: 1 });
    engine.play('win');
    expect(ctx.log.oscillators).toBe(0);
    expect(engine.played).toEqual([]);
    expect(engine.isUnlocked).toBe(false);
  });

  it('plays a cue after unlock and records it', () => {
    const { ctx, engine } = make();
    engine.setSettings({ sound: true, music: false, volume: 0.8 });
    engine.unlock();
    engine.play('win');
    expect(ctx.log.oscillators).toBe(CUES.win.voices.length);
    expect(engine.played).toEqual(['win']);
    expect(ctx.state).toBe('running');
  });

  it('every cue can be played without error and stops within its definition', () => {
    const { ctx, engine } = make();
    engine.setSettings({ sound: true, music: false, volume: 1 });
    engine.unlock();
    for (const id of ALL_CUES) expect(() => engine.play(id)).not.toThrow();
    expect(engine.played).toEqual(ALL_CUES);
    expect(ctx.log.maxStop).toBeLessThan(2);
  });

  it('sound off or volume 0 makes no new sound; the master gain follows the slider', () => {
    const { ctx, engine } = make();
    engine.setSettings({ sound: false, music: false, volume: 1 });
    engine.unlock();
    engine.play('step');
    expect(engine.played).toEqual([]);
    engine.setSettings({ sound: true, music: false, volume: 0 });
    engine.play('step');
    expect(engine.played).toEqual([]);
    engine.setSettings({ sound: true, music: false, volume: 0.5 });
    expect(ctx.log.masterSets.at(-1)).toBeCloseTo(0.25 * dbToGain(-12), 6);
    engine.play('step');
    expect(engine.played).toEqual(['step']);
  });

  it('music starts only when enabled, schedules notes, stops when disabled, and is deterministic', () => {
    const { ctx, t, engine } = make();
    engine.setSettings({ sound: true, music: false, volume: 1 });
    engine.unlock();
    expect(t.fns).toHaveLength(0);
    engine.setSettings({ sound: true, music: true, volume: 1 });
    expect(t.fns).toHaveLength(1);
    const before = ctx.log.oscillators;
    expect(before).toBeGreaterThan(0);
    ctx.currentTime = 10;
    t.fns[0]!();
    expect(ctx.log.oscillators).toBeGreaterThan(before);
    engine.setSettings({ sound: true, music: false, volume: 1 });
    expect(t.fns).toHaveLength(0);
    const a = make();
    const b = make();
    for (const x of [a, b]) {
      x.engine.setSettings({ sound: false, music: true, volume: 1 });
      x.engine.unlock();
      x.ctx.currentTime = 12;
      x.t.fns[0]!();
    }
    expect(a.ctx.log.oscillators).toBe(b.ctx.log.oscillators);
  });

  it('suspends while the tab is hidden and resumes after', () => {
    const { ctx, engine } = make();
    engine.unlock();
    engine.setHidden(true);
    expect(ctx.log.suspended).toBe(1);
    engine.setHidden(false);
    expect(ctx.log.resumed).toBeGreaterThanOrEqual(2);
  });

  it('an unavailable AudioContext degrades silently', () => {
    const engine = new AudioEngine(() => null);
    engine.unlock();
    expect(() => engine.play('win')).not.toThrow();
    expect(engine.isUnlocked).toBe(false);
  });
});

describe('events to cues', () => {
  const ev = (...es: GameEvent[]) => cuesForEvents(es);
  it('maps the engine events the player should hear', () => {
    expect(ev({ type: 'MOVED', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } })).toEqual(['step']);
    expect(ev({ type: 'BLOCKED', at: { x: 0, y: 0 }, reason: 'wall' })).toEqual(['bump']);
    expect(ev({ type: 'SWITCH_TOGGLED', id: 's', on: true })).toEqual(['switch_on']);
    expect(ev({ type: 'SWITCH_TOGGLED', id: 's', on: false })).toEqual(['switch_off']);
    expect(ev({ type: 'NO_EFFECT', targetId: 's' })).toEqual(['no_effect']);
    expect(ev({ type: 'EXIT_FOUND' })).toEqual(['exit_found']);
    expect(ev({ type: 'WON' })).toEqual(['win']);
  });

  it('a push is one sound, not push plus step; world-changing sounds outrank incidental ones; at most three', () => {
    const push = ev({ type: 'PUSHED', id: 'b', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }, { type: 'MOVED', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }, { type: 'PLATE_PRESSED', id: 'p' }, { type: 'DOOR_OPENED', id: 'd' });
    expect(push).toEqual(['door_open', 'push', 'plate_down']);
    const many = ev({ type: 'MOVED', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, { type: 'EPOCH_CHANGED', epoch: 1 }, { type: 'DOOR_CLOSED', id: 'd' }, { type: 'PLATE_RELEASED', id: 'p' });
    expect(many[0]).toBe('shift');
    expect(many).toHaveLength(3);
  });

  it('a switch that goes off by itself is a spring pop; one the player pressed is a plain switch-off', () => {
    const off: GameEvent = { type: 'SWITCH_TOGGLED', id: 's', on: false };
    expect(cuesForEvents([{ type: 'MOVED', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, off], { type: 'MOVE', direction: 'RIGHT' })).toEqual(['spring_pop', 'step']);
    expect(cuesForEvents([off], { type: 'INTERACT', targetId: 's' })).toEqual(['switch_off']);
    expect(cuesForEvents([{ type: 'SWITCH_TOGGLED', id: 'a', on: true }, { type: 'SWITCH_TOGGLED', id: 'b', on: false }], { type: 'INTERACT', targetId: 'a' })).toEqual(['switch_on', 'spring_pop']);
  });

  it('a commit is one cue; a plain reset is a reset cue', () => {
    expect(ev({ type: 'RESET' }, { type: 'COMMITTED', reason: 'player' })).toEqual(['commit']);
    expect(ev({ type: 'RESET' })).toEqual(['reset']);
  });

  it('real play of World 1 only produces cues from the table', () => {
    const s = create(LEVELS[0]!, 'x');
    for (const a of 'RRDDRRUU') {
      const r = step(s, { type: 'MOVE', direction: ({ U: 'UP', D: 'DOWN', L: 'LEFT', R: 'RIGHT' } as const)[a as 'U'] });
      for (const c of cuesForEvents(r.events)) expect(ALL_CUES).toContain(c);
    }
  });
});
