import { store } from '../../save/instance';

/**
 * The game's sound: tiny synthesised effects, no sample files (so nothing to license and nothing to download). Nothing plays until
 * the first key or tap, and everything follows the suite's Sound and Volume settings. Every effect is under 0.6 s.
 */
export type SfxId = 'jump' | 'land' | 'death' | 'respawn' | 'star' | 'button' | 'rumble' | 'thud' | 'vent' | 'track' | 'lock' | 'beam' | 'crumble' | 'win' | 'finale' | 'blip' | 'ui' | 'right' | 'wrong';

interface Tone {
  at: number;
  f: number;
  f2?: number;
  dur: number;
  type: OscillatorType;
  g: number;
}
interface Def {
  db: number;
  tones: Tone[];
  noise?: { dur: number; lp: number; g: number };
}

const n = (semi: number): number => 440 * 2 ** (semi / 12);

export const SFX: Record<SfxId, Def> = {
  jump: { db: -24, tones: [{ at: 0, f: 300, f2: 620, dur: 0.12, type: 'square', g: 0.5 }] },
  land: { db: -26, tones: [{ at: 0, f: 140, f2: 90, dur: 0.07, type: 'sine', g: 1 }], noise: { dur: 0.04, lp: 700, g: 0.2 } },
  death: { db: -16, tones: [{ at: 0, f: 380, f2: 90, dur: 0.32, type: 'sawtooth', g: 0.5 }, { at: 0.18, f: 160, f2: 70, dur: 0.2, type: 'square', g: 0.3 }], noise: { dur: 0.12, lp: 1800, g: 0.35 } },
  respawn: { db: -26, tones: [{ at: 0, f: 400, f2: 800, dur: 0.09, type: 'sine', g: 0.8 }] },
  star: { db: -18, tones: [{ at: 0, f: n(7), dur: 0.1, type: 'triangle', g: 1 }, { at: 0.08, f: n(14), f2: n(2), dur: 0.35, type: 'sine', g: 0.8 }] },
  button: { db: -18, tones: [{ at: 0, f: 200, f2: 120, dur: 0.1, type: 'square', g: 0.6 }, { at: 0.06, f: 520, dur: 0.18, type: 'triangle', g: 0.7 }] },
  rumble: { db: -22, tones: [{ at: 0, f: 70, f2: 55, dur: 0.3, type: 'sawtooth', g: 0.6 }], noise: { dur: 0.3, lp: 300, g: 0.35 } },
  thud: { db: -16, tones: [{ at: 0, f: 90, f2: 50, dur: 0.15, type: 'sine', g: 1 }], noise: { dur: 0.1, lp: 600, g: 0.4 } },
  vent: { db: -20, tones: [{ at: 0, f: 900, f2: 200, dur: 0.14, type: 'sawtooth', g: 0.4 }], noise: { dur: 0.14, lp: 3000, g: 0.3 } },
  track: { db: -32, tones: [{ at: 0, f: 1200, dur: 0.03, type: 'square', g: 0.4 }] },
  lock: { db: -24, tones: [{ at: 0, f: 880, dur: 0.05, type: 'square', g: 0.5 }, { at: 0.07, f: 660, dur: 0.05, type: 'square', g: 0.5 }] },
  beam: { db: -17, tones: [{ at: 0, f: 1500, f2: 300, dur: 0.22, type: 'sawtooth', g: 0.5 }], noise: { dur: 0.2, lp: 4000, g: 0.25 } },
  crumble: { db: -15, tones: [{ at: 0, f: 120, f2: 60, dur: 0.3, type: 'sawtooth', g: 0.5 }], noise: { dur: 0.35, lp: 1200, g: 0.5 } },
  win: { db: -14, tones: [{ at: 0, f: n(3), dur: 0.14, type: 'triangle', g: 1 }, { at: 0.12, f: n(7), dur: 0.14, type: 'triangle', g: 1 }, { at: 0.24, f: n(10), dur: 0.3, type: 'triangle', g: 1 }] },
  finale: { db: -13, tones: [{ at: 0, f: n(3), dur: 0.18, type: 'triangle', g: 1 }, { at: 0.14, f: n(7), dur: 0.18, type: 'triangle', g: 1 }, { at: 0.28, f: n(10), dur: 0.18, type: 'triangle', g: 1 }, { at: 0.42, f: n(15), dur: 0.5, type: 'triangle', g: 1 }, { at: 0.42, f: n(3), dur: 0.5, type: 'sine', g: 0.6 }] },
  blip: { db: -34, tones: [{ at: 0, f: 700, f2: 900, dur: 0.05, type: 'sine', g: 0.8 }] },
  ui: { db: -30, tones: [{ at: 0, f: 520, dur: 0.035, type: 'sine', g: 1 }] },
  right: { db: -26, tones: [{ at: 0, f: n(0), dur: 0.08, type: 'sine', g: 0.8 }, { at: 0.08, f: n(7), dur: 0.12, type: 'sine', g: 0.8 }] },
  wrong: { db: -26, tones: [{ at: 0, f: n(7), dur: 0.08, type: 'sine', g: 0.8 }, { at: 0.08, f: n(0), f2: n(-3), dur: 0.16, type: 'sine', g: 0.8 }] },
};

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Names of effects asked for, newest last; the browser tests read this to check the right sound followed the right moment. */
  readonly played: SfxId[] = [];

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(id: SfxId): void {
    const { sound, volume } = store.get().settings;
    if (!sound || volume <= 0) return;
    this.played.push(id);
    if (this.played.length > 100) this.played.shift();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const def = SFX[id];
    master.gain.setValueAtTime(volume * volume * 10 ** (-12 / 20), ctx.currentTime);
    const t0 = ctx.currentTime + 0.005;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(10 ** (def.db / 20), t0);
    bus.connect(master);
    for (const t of def.tones) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = t.type;
      osc.frequency.setValueAtTime(t.f, t0 + t.at);
      if (t.f2) osc.frequency.exponentialRampToValueAtTime(t.f2, t0 + t.at + t.dur);
      g.gain.setValueAtTime(0.0001, t0 + t.at);
      g.gain.linearRampToValueAtTime(t.g, t0 + t.at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.at + t.dur);
      osc.connect(g);
      g.connect(bus);
      osc.start(t0 + t.at);
      osc.stop(t0 + t.at + t.dur + 0.02);
    }
    if (def.noise) {
      const len = Math.max(1, Math.floor(ctx.sampleRate * def.noise.dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 4242;
      for (let i = 0; i < len; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        d[i] = (seed / 4294967296) * 2 - 1; // deterministic noise: the same effect always sounds the same
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(def.noise.lp, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(def.noise.g, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + def.noise.dur);
      src.connect(lp);
      lp.connect(g);
      g.connect(bus);
      src.start(t0);
      src.stop(t0 + def.noise.dur);
    }
  }
}

export const sfx = new Sfx();
