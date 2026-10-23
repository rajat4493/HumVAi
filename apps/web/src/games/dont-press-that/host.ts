import { HINTS, POOLS } from './lines';
import type { Mood, Tone } from './lines';
import type { BeamMode, DeathCause } from './sim';

/**
 * Professor Probably, the host. Event-driven and deterministic: he reacts to something that actually happened, picks the next unused
 * line from that trigger's pool, and keeps a little state (composure) that shows on his face. He has no access to the physics, so
 * his personality setting cannot change a jump or a hitbox, and he never needs a network or a model.
 */
export interface HostLine {
  key: string;
  text: string;
  mood: Mood;
  /** How long to show it, in ticks. */
  hold: number;
}

export type HostEventName = 'button' | 'drop_walk' | 'drop_button' | 'zone' | 'star' | 'star2' | 'wall' | 'final';

export type HostInput =
  | { kind: 'start'; level: number; attempt: number; mode: BeamMode | null }
  | { kind: 'death'; level: number; cause: DeathCause; deathsHere: number; nearGoal: boolean }
  | { kind: 'win'; level: number; deathsHere: number }
  | { kind: 'verdict'; level: number; id: string; verdict: 'correct' | 'wrong'; beamNo: number }
  | { kind: 'event'; name: HostEventName }
  | { kind: 'idle' }
  | { kind: 'quick' };

/** Minimum quiet time between lines that are not important, in ticks (60 per second). */
const GAP: Record<Tone, number> = { playful: 360, edge: 240, chaos: 150 };

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
};

/** What a rattled host sounds like: the first letter catches. Deterministic, and only below 35 composure. */
export const stutter = (text: string): string => {
  const m = /^(["']?)([A-Za-z])/.exec(text);
  if (!m) return text;
  const c = m[2]!;
  return `${text.slice(0, m[0].length - 1)}${c}-${c}-${text.slice(m[0].length - 1)}`;
};

export class Host {
  composure = 100;
  private readonly cursors = new Map<string, number>();
  private readonly last = new Map<string, number>();
  private lastSpoke = -1e9;
  private spokeKeys: string[] = [];

  constructor(
    public tone: Tone,
    public muted: boolean,
  ) {}

  /** The face he is wearing when nothing has just happened. */
  restingMood(): Mood {
    if (this.composure < 25) return 'glitch';
    if (this.composure < 55) return 'sulk';
    return 'smug';
  }

  private adjust(delta: number): void {
    this.composure = Math.max(0, Math.min(100, this.composure + delta));
  }

  /** The keys of the lines used so far, oldest first. For tests: no key repeats until its pool is used up. */
  get history(): readonly string[] {
    return this.spokeKeys;
  }

  private pick(key: string): HostLine | null {
    const pool = POOLS[key];
    if (!pool) return null;
    const lines = pool[this.tone].length > 0 ? pool[this.tone] : pool.playful;
    const start = this.cursors.get(key) ?? hash(key + this.tone) % lines.length;
    let idx = start % lines.length;
    if (lines.length > 1 && this.last.get(key) === idx) idx = (idx + 1) % lines.length;
    this.cursors.set(key, idx + 1);
    this.last.set(key, idx);
    let text = lines[idx]!;
    if (this.composure < 35) text = stutter(text);
    return { key, text, mood: this.composure < 25 && pool.mood !== 'defeated' ? 'glitch' : pool.mood, hold: Math.min(330, Math.max(150, 120 + text.length * 3)) };
  }

  /**
   * Reacts to one thing that happened at tick `now`. Always updates composure; returns a line only if there is something worth
   * saying, the host is not muted, and it is not too soon after the last line (unless the moment matters).
   */
  react(input: HostInput, now: number): HostLine | null {
    let key: string | null = null;
    let must = false;
    switch (input.kind) {
      case 'start':
        if (input.attempt === 1) key = `start.${input.level}`;
        else if (input.level === 4 && input.mode) key = input.mode === 'camp' ? 'l4.mode_camp' : 'l4.mode_lead';
        must = key !== null;
        break;
      case 'death':
        this.adjust(3);
        if (input.deathsHere === 10 || input.deathsHere === 6 || input.deathsHere === 3) {
          key = `death.streak${input.deathsHere}`;
          must = true;
        } else if (input.nearGoal && input.deathsHere > 1) key = 'death.near';
        else key = `death.${input.cause}`;
        if (input.deathsHere === 1) must = true; // the first death of a level always gets its explanation
        break;
      case 'win':
        this.adjust(input.level === 5 ? 0 : -12);
        if (input.level === 5) key = null; // the finale has its own line
        else key = input.deathsHere === 0 ? 'clear.first_try' : input.deathsHere >= 8 ? 'clear.many' : `clear.${input.level}`;
        must = true;
        break;
      case 'verdict':
        if (input.verdict === 'wrong') this.adjust(input.id.startsWith('beam') ? -3 : -8);
        else this.adjust(2);
        if (input.id.startsWith('beam')) {
          // Beams fire every couple of seconds: comment on the first miss, then only now and then.
          if (input.verdict === 'wrong' && (input.beamNo === 1 || input.beamNo % 4 === 0)) key = 'l4.miss';
        } else {
          key = input.verdict === 'wrong' ? 'verdict.wrong' : 'verdict.correct';
          must = input.verdict === 'wrong';
        }
        break;
      case 'event':
        switch (input.name) {
          case 'button': key = 'l1.button'; break;
          case 'drop_walk': key = 'l1.drop_walk'; break;
          case 'drop_button': key = 'l1.drop_button'; break;
          case 'zone': key = 'l2.vents'; break;
          case 'star': key = 'l3.star'; break;
          case 'star2': key = 'l3.star2'; break;
          case 'wall': this.adjust(-35); key = 'l5.wall'; must = true; break;
          case 'final': this.adjust(-60); key = 'l5.final'; must = true; break;
        }
        break;
      case 'idle':
        key = 'idle';
        break;
      case 'quick':
        key = 'restart.quick';
        break;
    }
    if (!key || this.muted) return null;
    if (!must && now - this.lastSpoke < GAP[this.tone]) return null;
    const line = this.pick(key);
    if (!line) return null;
    this.lastSpoke = now;
    this.spokeKeys.push(key);
    return line;
  }
}

export const hintFor = (level: number, tier: 0 | 1): string => HINTS[level]?.[tier] ?? '';
