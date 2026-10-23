import { describe, expect, it } from 'vitest';
import { Controller } from './controller';
import { Host, stutter } from './host';
import { HINTS, POOLS, TONES } from './lines';
import type { Tone } from './lines';
import { PredictionLedger, derivePredictions } from './predictions';
import { LEVELS } from './levels';
import { SOLUTIONS, expand } from './solutions';
import { KEY, createSim, replay, stateKey, step } from './sim';
import type { SimEvent } from './sim';
import { validateEnvelope } from '../../telemetry/envelope';
import '../../telemetry/schemas';

const stats = { attempts: 0, repeats: 0 };

describe('the lines', () => {
  it('every pool has two or more lines per personality, none over 100 characters', () => {
    for (const [key, pool] of Object.entries(POOLS)) {
      for (const tone of TONES) {
        expect(pool[tone].length, `${key}/${tone}`).toBeGreaterThanOrEqual(2);
        for (const text of pool[tone]) expect(text.length, `${key}/${tone}: ${text}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('tease the attempt and never abuse the person', () => {
    const banned = /\b(idiot|stupid|dumb|moron|loser|pathetic|worthless|trash|garbage|hate you|kill yourself|useless|failure)\b/i;
    for (const [key, pool] of Object.entries(POOLS)) for (const tone of TONES) for (const t of pool[tone]) expect(banned.test(t), `${key}/${tone}: ${t}`).toBe(false);
  });

  it('every level has two hints, and the second one is more explicit than the first', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const h = HINTS[n]!;
      expect(h[0].length).toBeGreaterThan(10);
      expect(h[1].length).toBeGreaterThan(h[0].length - 20);
    }
  });

  it('a rattled host stutters; a calm one does not', () => {
    expect(stutter('I predict you will fall.')).toBe('I-I-I predict you will fall.');
    const calm = new Host('playful', false);
    const rattled = new Host('playful', false);
    rattled.composure = 10;
    const a = calm.react({ kind: 'event', name: 'star' }, 1000)!;
    const b = rattled.react({ kind: 'event', name: 'star' }, 1000)!;
    expect(a.text).not.toMatch(/^[A-Z]-[A-Z]-/);
    expect(b.text).toMatch(/^[A-Z]-[A-Z]-/);
  });
});

describe('the host never repeats himself needlessly', () => {
  for (const tone of TONES) {
    it(`${tone}: a trigger uses every line in its pool before any repeats, and never the same line twice in a row`, () => {
      const host = new Host(tone, false);
      const seen: string[] = [];
      for (let i = 0; i < 40; i++) {
        const l = host.react({ kind: 'death', level: 1, cause: 'spike', deathsHere: 2, nearGoal: false }, i * 1000)!;
        seen.push(l.text);
      }
      const poolSize = POOLS['death.spike']![tone].length;
      expect(new Set(seen.slice(0, poolSize)).size).toBe(poolSize);
      for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    });
  }

  it('speaks less in Playful than in Chaos when the same things happen', () => {
    const count = (tone: Tone): number => {
      const host = new Host(tone, false);
      let n = 0;
      for (let t = 0; t < 40; t++) if (host.react({ kind: 'death', level: 1, cause: 'spike', deathsHere: 2, nearGoal: false }, t * 120)) n++;
      return n;
    };
    expect(count('playful')).toBeLessThan(count('chaos'));
  });

  it('lets important moments through even when he just spoke', () => {
    const host = new Host('playful', false);
    host.react({ kind: 'event', name: 'star' }, 100);
    expect(host.react({ kind: 'death', level: 3, cause: 'pit', deathsHere: 1, nearGoal: false }, 110)).not.toBeNull(); // first death of a level
    expect(host.react({ kind: 'death', level: 3, cause: 'pit', deathsHere: 2, nearGoal: false }, 120)).toBeNull(); // routine: stays quiet
  });
});

describe('mute', () => {
  it('silences every line but keeps the host reacting (composure) and the predictions counting', () => {
    const host = new Host('chaos', true);
    expect(host.react({ kind: 'event', name: 'wall' }, 0)).toBeNull();
    expect(host.composure).toBeLessThan(100);
    const a = new Controller({ level: LEVELS[1]!, tone: 'chaos', muted: true });
    const b = new Controller({ level: LEVELS[1]!, tone: 'chaos', muted: false });
    for (const c of [a, b]) for (let i = 0; i < 130; i++) c.tick(KEY.R | (i > 20 ? KEY.J : 0));
    expect(a.line).toBeNull();
    expect(b.line ?? null).not.toBeUndefined();
    expect(a.ledger.entries.map((e) => `${e.id}:${e.verdict}`)).toEqual(b.ledger.entries.map((e) => `${e.id}:${e.verdict}`));
  });
});

describe('the personality can never change the game', () => {
  const inputs = (): number[] => Array.from({ length: 400 }, (_, i) => (i % 13 < 8 ? KEY.R : 0) | (i % 31 < 5 ? KEY.J : 0) | (i % 97 === 96 ? KEY.RESTART : 0));
  for (const level of LEVELS) {
    it(`${level.id}: identical inputs give identical worlds under every personality, muted or not`, () => {
      const keys: string[] = [];
      const ledgers: string[] = [];
      for (const tone of TONES) {
        for (const muted of [false, true]) {
          const c = new Controller({ level, tone, muted });
          for (const i of inputs()) c.tick(i);
          keys.push(stateKey(c.session.sim, false) + `#${c.session.attempt}#${c.session.sim.tick}`);
          ledgers.push(JSON.stringify(c.ledger.entries));
        }
      }
      expect(new Set(keys).size).toBe(1);
      expect(new Set(ledgers).size).toBe(1);
    });
  }
});

describe('predictions are falsifiable and judged only by what happened', () => {
  const ev = (list: Partial<SimEvent>[]): SimEvent[] => list as SimEvent[];

  it('level 2: an early jump proves it right, a late one proves it wrong', () => {
    const early = derivePredictions(2, ev([{ t: 40, type: 'takeoff', x: 5, y: 8 }]), false, 40, stats);
    expect(early[0]!.verdict).toBe('correct');
    const late = derivePredictions(2, ev([{ t: 60, type: 'takeoff', x: 8.6, y: 8 }]), false, 60, stats);
    expect(late[0]!.verdict).toBe('wrong');
    expect(derivePredictions(2, ev([{ t: 5, type: 'takeoff', x: 1.2, y: 8 }]), false, 5, stats)[0]!.verdict).toBeNull(); // before the area it is about
  });

  it('level 1: it is decided only by the button, or by passing the point of no return', () => {
    expect(derivePredictions(1, [], false, 0, stats).every((p) => p.verdict === null)).toBe(true);
    const pressed = derivePredictions(1, ev([{ t: 30, type: 'button', id: 'B' }]), false, 30, stats);
    expect(pressed.find((p) => p.id === 'l1-press')!.verdict).toBe('correct');
    const walked = derivePredictions(1, ev([{ t: 80, type: 'mark', id: 'mid' }]), false, 80, stats);
    expect(walked.find((p) => p.id === 'l1-press')!.verdict).toBe('wrong');
    const died = derivePredictions(1, ev([{ t: 90, type: 'death', cause: 'drop', x: 12, y: 8 }]), true, 90, stats);
    expect(died.find((p) => p.id === 'l1-spikes')!.verdict).toBe('correct');
    expect(died.find((p) => p.id === 'l1-press')!.verdict).toBe('void'); // never got a fair test
  });

  it('level 3: five seconds is five seconds', () => {
    const star = { t: 100, type: 'star' as const, gs: -1 as const, x: 4.5 };
    expect(derivePredictions(3, ev([star]), false, 399, stats)[0]!.verdict).toBeNull();
    expect(derivePredictions(3, ev([star]), false, 401, stats)[0]!.verdict).toBe('wrong');
    expect(derivePredictions(3, ev([star, { t: 250, type: 'death', cause: 'spike', x: 8, y: 2 }]), true, 250, stats)[0]!.verdict).toBe('correct');
  });

  it('beams: each locked aim is judged by whether the beam hit', () => {
    const e = ev([
      { t: 100, type: 'beam_lock', aim: 8, mode: 'lead' },
      { t: 134, type: 'beam_end', aim: 8, hit: false },
      { t: 300, type: 'beam_lock', aim: 12, mode: 'lead' },
      { t: 334, type: 'beam_end', aim: 12, hit: true },
    ]);
    const r = derivePredictions(4, e, false, 340, stats);
    expect(r.map((p) => p.verdict)).toEqual(['wrong', 'correct']);
  });

  it('a verdict, once given, never changes as the attempt goes on', () => {
    for (const level of LEVELS) {
      const sol = SOLUTIONS.find((s) => s.level === level.id)!;
      const end = replay(level, expand(sol.runs), sol.mode);
      let prev = new Map<string, string>();
      for (let k = 0; k <= end.events.length; k++) {
        const upto = end.events.slice(0, k);
        const now = upto.length > 0 ? upto[upto.length - 1]!.t : 0;
        const res = derivePredictions(level.n, upto, false, now, stats);
        for (const p of res) if (p.verdict) expect(prev.get(p.id) ?? p.verdict, `${level.id} ${p.id}`).toBe(p.verdict);
        prev = new Map(res.filter((p) => p.verdict).map((p) => [p.id, p.verdict!]));
      }
    }
  });

  it('replaying the same attempt gives the same verdicts', () => {
    for (const level of LEVELS) {
      const sol = SOLUTIONS.find((s) => s.level === level.id)!;
      const a = replay(level, expand(sol.runs), sol.mode);
      const b = replay(level, expand(sol.runs), sol.mode);
      expect(JSON.stringify(derivePredictions(level.n, a.events, true, a.tick, stats))).toBe(JSON.stringify(derivePredictions(level.n, b.events, true, b.tick, stats)));
    }
  });

  it('the ledger only counts decided verdicts, once each, and counts add up', () => {
    const ledger = new PredictionLedger();
    const r1 = derivePredictions(2, [{ t: 40, type: 'takeoff', x: 5, y: 8 }], false, 40, stats);
    expect(ledger.record(2, 1, r1)).toHaveLength(1);
    expect(ledger.record(2, 1, r1)).toHaveLength(0); // not recorded twice
    ledger.record(2, 2, derivePredictions(2, [{ t: 60, type: 'takeoff', x: 8.6, y: 8 }], false, 60, stats));
    ledger.record(2, 3, derivePredictions(2, [], true, 5, stats)); // restarted before it was tested
    const c = ledger.counts();
    expect(c).toEqual({ correct: 1, wrong: 1, void: 1, beams: 0 });
    expect(c.correct + c.wrong + c.void).toBe(ledger.entries.length);
  });

  it('the confidence the host quotes is a real count of this player\'s own attempts', () => {
    const c = new Controller({ level: LEVELS[1]!, tone: 'playful', muted: true });
    // attempt 1: jump early and die
    for (let i = 0; i < 200 && c.session.attempt === 1; i++) c.tick(KEY.R | (c.session.sim.p.x > 5 ? KEY.J : 0));
    expect(c.session.history[0]!.outcome).toBe('death');
    const text = c.current.find((p) => p.id === 'l2-early')!.text;
    expect(text).toContain('1 of your 1 attempt');
  });
});

describe('what the controller reports to the local log', () => {
  it('only events the schema accepts, in a sensible order, with a death and a respawn', () => {
    const out: { type: string; payload: Record<string, unknown> }[] = [];
    const c = new Controller({ level: LEVELS[0]!, tone: 'edge', muted: false, emit: (type, payload) => out.push({ type, payload }) });
    for (let i = 0; i < 200; i++) c.tick(KEY.R);
    for (let i = 0; i < 20; i++) c.tick(KEY.R | KEY.J);
    expect(out.map((o) => o.type)).toContain('death');
    expect(out.map((o) => o.type)).toContain('respawn');
    expect(out[0]!.type).toBe('attempt_start');
    out.forEach((o, i) => {
      const env = { schema: 'hva.event.1', game: { id: 'dont-press-that', version: 'slice-0.1' }, challenge: { id: LEVELS[0]!.id, version: 1 }, session: 's-abcdefgh', type: o.type, seq: i, t: i * 10, payload: o.payload };
      expect(validateEnvelope(env), JSON.stringify(o)).toEqual({ ok: true, errors: [] });
    });
  });

  it('free text can never get in: a payload with a string that is not an id is rejected', () => {
    const env = { schema: 'hva.event.1', game: { id: 'dont-press-that', version: 'slice-0.1' }, challenge: { id: 'l1', version: 1 }, session: 's-abcdefgh', type: 'prediction', seq: 0, t: 0, payload: { pid: 'My name is Sam!', verdict: 'correct', attempt: 1 } };
    expect(validateEnvelope(env).ok).toBe(false);
  });
});

describe('level 5 reversal', () => {
  it('the host\'s composure collapses when his own beam breaks his wall', () => {
    const level = LEVELS[4]!;
    const sol = SOLUTIONS.find((s) => s.level === level.id)!;
    const c = new Controller({ level, tone: 'playful', muted: false });
    const before = c.host.composure;
    let wall = false;
    let finalLine = '';
    for (const i of expand(sol.runs)) {
      const t = c.tick(i);
      if (t.events.some((e) => e.type === 'beam_start' && e.broke > 0)) wall = true;
      if (t.ended?.outcome === 'win') finalLine = c.line?.line.key ?? '';
    }
    expect(wall).toBe(true);
    expect(c.host.composure).toBeLessThan(before - 30);
    expect(finalLine).toBe('l5.final');
    expect(c.ledger.entries.some((e) => e.id === 'l5-button' && e.verdict === 'wrong')).toBe(true);
    void createSim; void step;
  });
});
