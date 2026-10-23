import { Host } from './host';
import type { HostInput, HostLine } from './host';
import type { Mood, Tone } from './lines';
import { PredictionLedger, derivePredictions } from './predictions';
import type { LedgerEntry, PredictionResult, PredictionStats } from './predictions';
import { Session } from './session';
import type { AttemptSummary } from './session';
import { RESPAWN_TICKS } from './sim';
import type { LevelDef, SimEvent } from './sim';

/**
 * One level being played: the simulation (via Session), the host reacting to it, and the prediction ledger. Headless, so the same
 * object runs under the canvas and under the tests. `emit` is where structured events go (the screen wires it to the consent-gated
 * local log; tests wire it to an array).
 */
export type Emit = (type: string, payload: Record<string, unknown>) => void;

export interface ControllerOptions {
  level: LevelDef;
  tone: Tone;
  muted: boolean;
  /** Shared across a whole playthrough, so the finale can say how right the host was overall. */
  ledger?: PredictionLedger;
  /** Earlier attempts at this level in this visit (so the host's memory survives leaving and coming back). */
  prior?: readonly AttemptSummary[];
  emit?: Emit;
}

export interface TickInfo {
  events: SimEvent[];
  newLine: HostLine | null;
  ended: AttemptSummary | null;
  respawned: boolean;
  verdicts: LedgerEntry[];
}

const IDLE_TICKS = 420;

export function predictionStats(levelN: number, history: readonly AttemptSummary[]): PredictionStats {
  let repeats = 0;
  for (const a of history) {
    if (levelN === 1 && a.events.some((e) => e.type === 'button')) repeats++;
    if (levelN === 2) {
      const j = a.events.find((e) => e.type === 'takeoff' && e.x >= 2) as Extract<SimEvent, { type: 'takeoff' }> | undefined;
      if (j && j.x < 8) repeats++;
    }
  }
  return { attempts: history.length, repeats };
}

/** Runs of ints that fit the event schema: at most 240 runs, noting if the rest was left out. */
const cap = (runs: number[]): number[] => runs.slice(0, 240);

export class Controller {
  readonly session: Session;
  readonly host: Host;
  readonly ledger: PredictionLedger;
  line: { line: HostLine; until: number } | null = null;
  mood: Mood = 'smug';
  moodUntil = 0;
  /** The decided-so-far predictions of the current attempt, for the on-screen ticker. */
  current: PredictionResult[] = [];
  private starsThisAttempt = 0;
  private idle = 0;
  private idleSaid = false;
  private beamNo = 0;
  private readonly emit: Emit;
  private readonly reported = new Set<number>();

  constructor(readonly opts: ControllerOptions) {
    this.session = new Session(opts.level, opts.prior ?? []);
    this.host = new Host(opts.tone, opts.muted);
    this.ledger = opts.ledger ?? new PredictionLedger();
    this.emit = opts.emit ?? (() => undefined);
    this.beginAttempt();
  }

  get deathsHere(): number {
    return this.session.history.filter((a) => a.outcome === 'death').length;
  }

  setHost(tone: Tone, muted: boolean): void {
    this.host.tone = tone;
    this.host.muted = muted;
  }

  private say(input: HostInput): HostLine | null {
    const clock = this.session.clock;
    const l = this.host.react(input, clock);
    if (l) {
      this.line = { line: l, until: clock + l.hold };
      this.mood = l.mood;
      this.moodUntil = clock + l.hold;
    }
    return l;
  }

  private beginAttempt(): HostLine | null {
    this.starsThisAttempt = 0;
    this.idle = 0;
    this.idleSaid = false;
    this.beamNo = 0;
    const s = this.session;
    this.emit('attempt_start', { attempt: s.attempt, mode: s.mode ?? 'none', personality: this.host.tone, host_muted: this.host.muted });
    this.current = derivePredictions(this.opts.level.n, [], false, 0, predictionStats(this.opts.level.n, s.history));
    return this.say({ kind: 'start', level: this.opts.level.n, attempt: s.attempt, mode: s.mode });
  }

  /** Where the goal is, to tell a near miss from a far one. */
  private nearGoal(x: number, y: number): boolean {
    const p = this.session.sim.parsed;
    const goal = this.opts.level.goal === 'exit' ? p.exit : p.buttons.find((b) => b.kind === 'R');
    if (!goal) return false;
    const gx = this.opts.level.goal === 'exit' ? (goal as { x: number }).x : (goal as { x: number }).x + 0.5;
    return Math.hypot(gx - x, 0) < 2.5 && y > 0;
  }

  tick(input: number): TickInfo {
    const s = this.session;
    const level = this.opts.level;
    const out = s.step(input);
    const clock = s.clock;
    let newLine: HostLine | null = null;
    const say = (i: HostInput): void => {
      const l = this.say(i);
      if (l) newLine = l;
    };

    if (out.respawned) {
      const prev = s.history[s.history.length - 1];
      this.emit('respawn', { attempt: prev?.n ?? 0, latency_ms: Math.round(((prev?.respawnTicks ?? 0) * 1000) / 60) });
      const begun = this.beginAttempt();
      if (begun) newLine = begun;
      else if (prev && prev.outcome === 'death' && (prev.respawnTicks ?? RESPAWN_TICKS) < RESPAWN_TICKS) say({ kind: 'quick' });
    }

    // time to retry, reported once the player has touched a control in the new attempt
    const done = s.history[s.history.length - 1];
    if (done && done.retryTicks !== null && !this.reported.has(done.n)) {
      this.reported.add(done.n);
      this.emit('retry_input', { attempt: done.n + 1, time_to_retry_ms: Math.round(((done.retryTicks + (done.respawnTicks ?? 0)) * 1000) / 60) });
    }

    for (const e of out.events) {
      switch (e.type) {
        case 'button':
          if (e.id === 'B') say({ kind: 'event', name: 'button' });
          break;
        case 'drop_trigger':
          say({ kind: 'event', name: e.by === 'button' ? 'drop_button' : 'drop_walk' });
          break;
        case 'zone_trigger':
          say({ kind: 'event', name: 'zone' });
          break;
        case 'star':
          this.starsThisAttempt++;
          say({ kind: 'event', name: this.starsThisAttempt === 1 ? 'star' : 'star2' });
          break;
        case 'beam_start':
          if (e.broke > 0) say({ kind: 'event', name: 'wall' });
          break;
        default:
          break;
      }
    }

    const ended = out.ended;
    const attempt = ended ? ended.n : s.attempt;
    const events = ended ? ended.events : s.sim.events;
    const results = derivePredictions(level.n, events, ended !== null, ended ? ended.ticks : s.sim.tick, predictionStats(level.n, s.history.filter((a) => a.n < attempt)));
    this.current = results;
    const verdicts = this.ledger.record(level.n, attempt, results);
    for (const v of verdicts) {
      this.emit('prediction', { pid: v.id.replace(/[^a-z0-9_-]/g, '-'), verdict: v.verdict, attempt });
      if (v.verdict === 'void') continue;
      if (v.id.startsWith('beam-')) this.beamNo++;
      const diedToBeam = ended?.cause === 'beam';
      if (v.id === 'l5-button' || (v.id.startsWith('beam-') && diedToBeam && v.verdict === 'correct')) {
        if (v.id === 'l5-button') this.host.react({ kind: 'verdict', level: level.n, id: v.id, verdict: 'wrong', beamNo: 0 }, clock + 1e9); // composure only: the finale line covers it
        continue;
      }
      say({ kind: 'verdict', level: level.n, id: v.id, verdict: v.verdict, beamNo: this.beamNo });
    }

    if (ended) {
      const inputs = { attempt: ended.n, outcome: ended.outcome, runs: cap(ended.inputs) };
      this.emit('inputs', inputs);
      if (ended.outcome === 'death') {
        this.emit('death', { attempt: ended.n, cause: ended.cause ?? 'spike', x10: Math.round((ended.deathX ?? 0) * 10), y10: Math.round((ended.deathY ?? 0) * 10), ticks: ended.ticks, still_max: ended.stillMax });
        say({ kind: 'death', level: level.n, cause: ended.cause ?? 'spike', deathsHere: this.deathsHere, nearGoal: this.nearGoal(ended.deathX ?? 0, ended.deathY ?? 0) });
      } else if (ended.outcome === 'win') {
        this.emit('complete', { attempt: ended.n, ticks: ended.ticks, deaths: this.deathsHere });
        if (level.n === 5) say({ kind: 'event', name: 'final' });
        else say({ kind: 'win', level: level.n, deathsHere: this.deathsHere });
      } else {
        this.emit('restart', { attempt: ended.n, ticks: ended.ticks });
      }
    }

    // a long, quiet stand-still gets one gentle remark per stretch
    if (!ended && !s.sim.dead && !s.sim.won) {
      if (input !== 0 || Math.abs(s.sim.p.vx) > 0.3) {
        this.idle = 0;
        this.idleSaid = false;
      } else if (++this.idle >= IDLE_TICKS && !this.idleSaid && s.sim.tick > 120) {
        this.idleSaid = true;
        say({ kind: 'idle' });
      }
    }
    if (this.line && clock >= this.line.until) this.line = null;
    if (clock >= this.moodUntil) this.mood = this.host.restingMood();
    return { events: out.events, newLine, ended, respawned: out.respawned, verdicts };
  }
}
