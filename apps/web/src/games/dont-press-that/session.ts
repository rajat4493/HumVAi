import { KEY, RESPAWN_MIN, RESPAWN_TICKS, createSim, step } from './sim';
import type { BeamMode, DeathCause, LevelDef, Sim, SimEvent } from './sim';

/**
 * Attempts, respawns and what the player did, on top of the pure simulation. Still no browser and no host: a test can drive it with a
 * list of inputs, and the screen drives it with the keyboard. One `step` is one 1/60 s tick.
 */
export interface AttemptSummary {
  n: number;
  outcome: 'death' | 'win' | 'restart';
  ticks: number;
  cause: DeathCause | null;
  deathX: number | null;
  deathY: number | null;
  /** Longest run of ticks standing still (after first moving). What the host reads to choose how to aim in level 4. */
  stillMax: number;
  mode: BeamMode | null;
  events: SimEvent[];
  /** Run-length encoded inputs: keys + 16 * ticks. */
  inputs: number[];
  /** Ticks from respawn until the player touched a control; filled in once the next attempt starts moving. */
  retryTicks: number | null;
  /** Ticks the body was broken before control came back. Always <= RESPAWN_TICKS. */
  respawnTicks: number | null;
}

export interface StepOut {
  /** Events the simulation produced this tick. */
  events: SimEvent[];
  /** Set on the tick an attempt ends (death, win, restart). */
  ended: AttemptSummary | null;
  /** True on the tick a fresh attempt begins. */
  respawned: boolean;
}

/** Tactic -> how the host aims next time. Pure: tests can call it. Short or missing attempts do not change the host's mind. */
export function chooseMode(history: readonly AttemptSummary[], fallback: BeamMode = 'lead'): BeamMode {
  for (let i = history.length - 1; i >= 0; i--) {
    const a = history[i]!;
    if (a.ticks >= 60) return a.stillMax >= 36 ? 'camp' : 'lead';
  }
  return fallback;
}

export const STILL_LIMIT = 36;

export class Session {
  sim: Sim;
  attempt = 1;
  readonly history: AttemptSummary[] = [];
  clock = 0;
  private prevInput = 0;
  private cur: number[] = [];
  private lastKeys = -1;
  private run = 0;
  private still = 0;
  private stillMax = 0;
  private moved = false;
  private deathClock = -1;
  private waitingForInput = false;
  private lastEnded: AttemptSummary | null = null;
  /** The mode the host is using this attempt (null for levels without beams). */
  mode: BeamMode | null = null;

  constructor(
    readonly level: LevelDef,
    priorHistory: readonly AttemptSummary[] = [],
  ) {
    this.history.push(...priorHistory);
    this.attempt = priorHistory.length + 1;
    this.sim = this.fresh();
  }

  private fresh(): Sim {
    this.mode = this.level.beams === 'adaptive' ? chooseMode(this.history) : this.level.beams === 'lead' ? 'lead' : null;
    this.cur = [];
    this.lastKeys = -1;
    this.run = 0;
    this.still = 0;
    this.stillMax = 0;
    this.moved = false;
    return createSim(this.level, this.mode ?? 'lead');
  }

  private flush(): void {
    if (this.lastKeys >= 0 && this.run > 0) this.cur.push(this.lastKeys + 16 * this.run);
    this.run = 0;
  }

  private summarize(outcome: AttemptSummary['outcome']): AttemptSummary {
    this.flush();
    const d = this.sim.dead;
    const s: AttemptSummary = {
      n: this.attempt,
      outcome,
      ticks: this.sim.tick,
      cause: d?.cause ?? null,
      deathX: d?.x ?? null,
      deathY: d?.y ?? null,
      stillMax: this.stillMax,
      mode: this.mode,
      events: this.sim.events.slice(),
      inputs: this.cur.slice(),
      retryTicks: null,
      respawnTicks: null,
    };
    this.history.push(s);
    this.lastEnded = s;
    return s;
  }

  /** Where the next attempt begins. The old one is already recorded. */
  private begin(): void {
    this.attempt++;
    this.sim = this.fresh();
    this.waitingForInput = true;
  }

  step(input: number): StepOut {
    this.clock++;
    const edge = input & ~this.prevInput;
    this.prevInput = input;
    const out: StepOut = { events: [], ended: null, respawned: false };
    const sim = this.sim;
    if (sim.won) return out;

    if (sim.dead) {
      const skip = (edge & (KEY.L | KEY.R | KEY.J | KEY.RESTART)) !== 0 && sim.dead.ticks >= RESPAWN_MIN;
      step(sim, 0);
      if (sim.dead.ticks >= RESPAWN_TICKS || skip) {
        const last = this.history[this.history.length - 1];
        if (last) last.respawnTicks = sim.dead.ticks;
        this.begin();
        out.respawned = true;
      }
      return out;
    }

    if ((edge & KEY.RESTART) !== 0) {
      out.ended = this.summarize('restart');
      this.begin();
      out.respawned = true;
      return out;
    }

    // time to retry: from the moment control returned to the first thing the player pressed
    if (this.waitingForInput && (input & (KEY.L | KEY.R | KEY.J)) !== 0) {
      this.waitingForInput = false;
      const prev = this.history[this.history.length - 1];
      if (prev && prev.retryTicks === null) prev.retryTicks = sim.tick;
    }

    // run-length record of what was held
    const keys = input & (KEY.L | KEY.R | KEY.J);
    if (keys === this.lastKeys) this.run++;
    else {
      this.flush();
      this.lastKeys = keys;
      this.run = 1;
    }

    const before = sim.events.length;
    step(sim, input);
    out.events = sim.events.slice(before);

    // standing still after first moving (what a "camper" does)
    if (!this.moved && Math.abs(sim.p.vx) > 0.5) this.moved = true;
    if (this.moved) {
      if (Math.abs(sim.p.vx) < 0.3 && sim.p.grounded) this.still++;
      else this.still = 0;
      if (this.still > this.stillMax) this.stillMax = this.still;
    }

    if (sim.dead) out.ended = this.summarize('death');
    else if (sim.won) out.ended = this.summarize('win');
    return out;
  }

  /** Abandon this level entirely (skip, leave). Records nothing as a death. */
  get lastAttempt(): AttemptSummary | null {
    return this.lastEnded;
  }
}
