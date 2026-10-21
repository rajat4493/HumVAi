import type { CueId } from './cues';

/** The slice of the Web Audio API the engine uses, so tests can supply a recording fake. */
export interface ParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
  cancelScheduledValues(t: number): unknown;
}
export interface NodeLike {
  connect(n: unknown): unknown;
  disconnect?(): unknown;
}
export interface OscLike extends NodeLike {
  type: string;
  frequency: ParamLike;
  start(t: number): void;
  stop(t: number): void;
}
export interface GainLike extends NodeLike {
  gain: ParamLike;
}
export interface FilterLike extends NodeLike {
  type: string;
  frequency: ParamLike;
  Q: { value: number };
}
export interface CtxLike {
  currentTime: number;
  state: string;
  destination: unknown;
  sampleRate: number;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createOscillator(): OscLike;
  createGain(): GainLike;
  createBiquadFilter(): FilterLike;
  createBuffer(channels: number, length: number, rate: number): { getChannelData(c: number): Float32Array };
  createBufferSource(): NodeLike & { buffer: unknown; start(t: number): void; stop(t: number): void };
}

export interface AudioSettings {
  sound: boolean;
  music: boolean;
  volume: number;
}

type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth';
interface Voice {
  /** Start time offset in seconds. */
  at: number;
  /** Frequency at start and (optionally) end, in Hz. */
  f: number;
  f2?: number;
  dur: number;
  type: Wave;
  /** Peak gain, linear, before the cue gain. */
  g: number;
  attack?: number;
}
interface CueDef {
  /** Cue loudness in dB relative to master (docs/design/rivalry-experience-spec.md section 7). */
  db: number;
  voices: Voice[];
  /** Optional short noise burst (thuds, slides). */
  noise?: { at: number; dur: number; lp: number; g: number };
}

const note = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);
const C5 = note(3), E5 = note(7), G5 = note(10), D5 = note(5), A5 = note(12), G4 = note(-2), D4 = note(-7), C4 = note(-9), E4 = note(-5);

/** Every cue is synthesised here from oscillators and noise. No sample files, so no third-party licensing. */
export const CUES: Record<CueId, CueDef> = {
  step: { db: -24, voices: [{ at: 0, f: 220, dur: 0.09, type: 'triangle', g: 1, attack: 0.008 }] },
  bump: { db: -20, voices: [{ at: 0, f: 110, f2: 80, dur: 0.08, type: 'sine', g: 1, attack: 0.004 }], noise: { at: 0, dur: 0.04, lp: 500, g: 0.25 } },
  push: { db: -20, voices: [{ at: 0.05, f: 120, f2: 90, dur: 0.09, type: 'sine', g: 1, attack: 0.004 }], noise: { at: 0, dur: 0.12, lp: 400, g: 0.35 } },
  drag: { db: -22, voices: [{ at: 0.06, f: 150, f2: 120, dur: 0.08, type: 'sine', g: 0.8, attack: 0.004 }], noise: { at: 0, dur: 0.14, lp: 700, g: 0.3 } },
  switch_on: { db: -20, voices: [{ at: 0, f: 330, dur: 0.06, type: 'sine', g: 1 }, { at: 0.055, f: 494, dur: 0.07, type: 'sine', g: 1 }] },
  switch_off: { db: -20, voices: [{ at: 0, f: 494, dur: 0.06, type: 'sine', g: 1 }, { at: 0.055, f: 330, dur: 0.07, type: 'sine', g: 1 }] },
  no_effect: { db: -26, voices: [{ at: 0, f: 180, dur: 0.035, type: 'triangle', g: 1 }, { at: 0.06, f: 180, dur: 0.035, type: 'triangle', g: 1 }] },
  door_open: { db: -22, voices: [{ at: 0, f: 300, f2: 520, dur: 0.2, type: 'sine', g: 0.5, attack: 0.03 }], noise: { at: 0, dur: 0.2, lp: 800, g: 0.3 } },
  door_close: { db: -22, voices: [{ at: 0, f: 200, dur: 0.05, type: 'sine', g: 1 }], noise: { at: 0, dur: 0.06, lp: 900, g: 0.3 } },
  plate_down: { db: -22, voices: [{ at: 0, f: 140, dur: 0.08, type: 'sine', g: 1, attack: 0.005 }] },
  plate_up: { db: -22, voices: [{ at: 0, f: 190, dur: 0.08, type: 'sine', g: 0.8, attack: 0.005 }] },
  shift: { db: -18, voices: [{ at: 0, f: 400, f2: 1200, dur: 0.5, type: 'sine', g: 0.8, attack: 0.05 }, { at: 0.02, f: 600, f2: 1800, dur: 0.45, type: 'sine', g: 0.35, attack: 0.05 }] },
  commit: { db: -18, voices: [{ at: 0, f: 600, f2: 200, dur: 0.25, type: 'sine', g: 0.8, attack: 0.01 }, { at: 0.26, f: C5, dur: 0.09, type: 'triangle', g: 1, attack: 0.004 }] },
  reset: { db: -22, voices: [{ at: 0, f: 400, f2: 160, dur: 0.18, type: 'sine', g: 0.7, attack: 0.01 }] },
  exit_found: { db: -20, voices: [{ at: 0, f: E5, dur: 0.12, type: 'triangle', g: 0.9 }, { at: 0.1, f: A5, dur: 0.22, type: 'sine', g: 0.8, attack: 0.01 }] },
  win: { db: -14, voices: [{ at: 0, f: C5, dur: 0.16, type: 'triangle', g: 1, attack: 0.01 }, { at: 0.14, f: E5, dur: 0.16, type: 'triangle', g: 1, attack: 0.01 }, { at: 0.28, f: G5, dur: 0.28, type: 'triangle', g: 1, attack: 0.01 }] },
  loss: { db: -18, voices: [{ at: 0, f: G4, dur: 0.2, type: 'sine', g: 1, attack: 0.01 }, { at: 0.2, f: D4, dur: 0.26, type: 'sine', g: 1, attack: 0.01 }] },
  ui_click: { db: -28, voices: [{ at: 0, f: 520, dur: 0.035, type: 'sine', g: 1, attack: 0.003 }] },
  // Human side is warm (triangle/sine, low-mid); AI side is glassy (sine + a 2:1 partial, mid-high).
  reveal_human: { db: -14, voices: [{ at: 0, f: C4, dur: 0.9, type: 'triangle', g: 0.6, attack: 0.15 }, { at: 0, f: E4, dur: 0.9, type: 'triangle', g: 0.5, attack: 0.15 }, { at: 0, f: note(-2 + 0), dur: 0.9, type: 'triangle', g: 0.5, attack: 0.15 }] },
  reveal_ai: { db: -14, voices: [{ at: 0, f: D5, dur: 0.9, type: 'sine', g: 0.6, attack: 0.12 }, { at: 0, f: A5, dur: 0.9, type: 'sine', g: 0.45, attack: 0.12 }, { at: 0.05, f: D5 * 2, dur: 0.7, type: 'sine', g: 0.2, attack: 0.12 }] },
  reveal_tie: { db: -14, voices: [{ at: 0, f: C5, dur: 0.9, type: 'triangle', g: 0.5, attack: 0.15 }, { at: 0, f: C5, dur: 0.9, type: 'sine', g: 0.5, attack: 0.15 }, { at: 0.3, f: C5 * 2, dur: 0.6, type: 'sine', g: 0.2, attack: 0.15 }] },
  reveal_none: { db: -22, voices: [{ at: 0, f: 330, dur: 0.15, type: 'sine', g: 1, attack: 0.005 }] },
  // Replay tick: quieter than human cues so a replay is never loud.
  ai_step: { db: -30, voices: [{ at: 0, f: 523, dur: 0.06, type: 'sine', g: 1, attack: 0.004 }, { at: 0, f: 1046, dur: 0.05, type: 'sine', g: 0.35, attack: 0.004 }] },
};

export const dbToGain = (db: number): number => 10 ** (db / 20);
/** Master level: perceptual curve from the 0..1 slider, then -12 dBFS headroom. */
export const masterGain = (volume: number): number => volume * volume * dbToGain(-12);

export class AudioEngine {
  private ctx: CtxLike | null = null;
  private master: GainLike | null = null;
  private sfxBus: GainLike | null = null;
  private musicBus: GainLike | null = null;
  private unlocked = false;
  private settings: AudioSettings = { sound: true, music: true, volume: 0.7 };
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicNext = 0;
  private musicStep = 0;
  private intensity: 'scout' | 'run' = 'scout';
  /** For tests and the e2e debug hook. */
  readonly played: CueId[] = [];

  constructor(
    private readonly makeCtx: () => CtxLike | null,
    private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setInterval> = (fn, ms) => setInterval(fn, ms),
    private readonly clearTimer: (t: ReturnType<typeof setInterval>) => void = (t) => clearInterval(t),
  ) {}

  get isUnlocked(): boolean {
    return this.unlocked;
  }
  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  /** Browsers only allow audio after a user gesture; nothing is created or played before this. */
  unlock(): void {
    if (this.unlocked) {
      void this.ctx?.resume();
      return;
    }
    const ctx = this.makeCtx();
    if (!ctx) return;
    this.ctx = ctx;
    this.unlocked = true;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(ctx.destination);
    this.applySettings();
    void ctx.resume();
    if (this.settings.music) this.startMusic();
  }

  setSettings(s: AudioSettings): void {
    this.settings = s;
    this.applySettings();
    if (!this.unlocked) return;
    if (s.music) this.startMusic();
    else this.stopMusic();
  }

  private applySettings(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setValueAtTime(masterGain(this.settings.volume), t);
    this.sfxBus.gain.setValueAtTime(this.settings.sound ? 1 : 0, t);
    this.musicBus.gain.setValueAtTime(this.settings.music ? dbToGain(-26) : 0, t);
  }

  play(cue: CueId): void {
    if (!this.ctx || !this.sfxBus || !this.settings.sound || this.settings.volume <= 0) return;
    const def = CUES[cue];
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.005;
    const cueGain = ctx.createGain();
    cueGain.gain.setValueAtTime(dbToGain(def.db), t0);
    cueGain.connect(this.sfxBus);
    for (const v of def.voices) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = v.type;
      osc.frequency.setValueAtTime(v.f, t0 + v.at);
      if (v.f2) osc.frequency.exponentialRampToValueAtTime(v.f2, t0 + v.at + v.dur);
      const a = v.attack ?? 0.006;
      g.gain.setValueAtTime(0.0001, t0 + v.at);
      g.gain.linearRampToValueAtTime(v.g, t0 + v.at + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + v.at + v.dur);
      osc.connect(g);
      g.connect(cueGain);
      osc.start(t0 + v.at);
      osc.stop(t0 + v.at + v.dur + 0.02);
    }
    if (def.noise) {
      const n = def.noise;
      const len = Math.max(1, Math.floor(ctx.sampleRate * n.dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; // deterministic noise: the same cue always sounds the same
        data[i] = (seed / 4294967296) * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(n.lp, t0 + n.at);
      lp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(n.g, t0 + n.at);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      src.connect(lp);
      lp.connect(g);
      g.connect(cueGain);
      src.start(t0 + n.at);
      src.stop(t0 + n.at + n.dur);
    }
    this.played.push(cue);
    if (this.played.length > 200) this.played.shift();
  }

  setIntensity(i: 'scout' | 'run'): void {
    this.intensity = i;
  }

  // ---- generative background music: a slow pad over a minor-pentatonic mode, with a sparse bell line in the Run ----
  private static readonly CHORDS: number[][] = [
    [-12, -5, 0],   // A minor-ish
    [-16, -9, -4],  // F
    [-14, -7, -2],  // G
    [-17, -10, -5], // E-ish, resolves back
  ];
  private static readonly SCALE = [0, 3, 5, 7, 10, 12, 15, 17];

  startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = this.setTimer(() => this.scheduleMusic(), 250);
    this.scheduleMusic();
  }

  stopMusic(): void {
    if (this.musicTimer) this.clearTimer(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const BAR = 6; // seconds per chord
    while (this.musicNext < ctx.currentTime + 1.5) {
      const t = this.musicNext;
      const bar = Math.floor(this.musicStep / 4);
      const beat = this.musicStep % 4;
      if (beat === 0) {
        const chord = AudioEngine.CHORDS[bar % AudioEngine.CHORDS.length] as number[];
        for (const semis of chord) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(note(semis), t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.22, t + 1.6);
          g.gain.linearRampToValueAtTime(0.0001, t + BAR + 0.8);
          osc.connect(g);
          g.connect(bus);
          osc.start(t);
          osc.stop(t + BAR + 0.9);
        }
      }
      // sparse bell notes; denser in the Run. Deterministic per step so the music never depends on randomness.
      const h = (Math.imul(this.musicStep + 7, 2654435761) >>> 0) / 4294967296;
      const play = this.intensity === 'run' ? h < 0.55 : h < 0.22;
      if (play) {
        const degree = AudioEngine.SCALE[Math.floor(h * 997) % AudioEngine.SCALE.length] as number;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note(degree), t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        osc.connect(g);
        g.connect(bus);
        osc.start(t);
        osc.stop(t + 1.7);
      }
      this.musicStep += 1;
      this.musicNext += BAR / 4;
    }
  }

  /** Pause everything while the tab is hidden. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    void (hidden ? this.ctx.suspend() : this.ctx.resume());
  }
}
