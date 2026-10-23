import type { SimEvent } from './sim';

/**
 * The host's predictions, and how each one is judged.
 *
 * A prediction is a sentence plus a rule over the recorded events of one attempt. Nothing here looks at the host's mood or the
 * player's settings, and nothing is decided by a random number, so the same attempt always yields the same verdicts: the tests
 * replay attempts and compare. A prediction that never gets a fair test (you died first, you restarted) is `void` and is
 * not counted for or against the host. Confidence numbers are only ever real counts from this player's own earlier attempts.
 */
export type Verdict = 'correct' | 'wrong' | 'void';

export interface PredictionStats {
  /** Attempts at this level before this one. */
  attempts: number;
  /** How many of them did the thing the host expects (pressed the button, jumped early, ...). Only used for wording. */
  repeats: number;
}

export interface PredictionResult {
  id: string;
  text: string;
  /** null while it is still undecided. */
  verdict: Verdict | null;
  tick: number | null;
}

const ticksOf = (events: readonly SimEvent[], type: SimEvent['type']): SimEvent[] => events.filter((e) => e.type === type);
const first = <T extends SimEvent['type']>(events: readonly SimEvent[], type: T): Extract<SimEvent, { type: T }> | undefined => events.find((e) => e.type === type) as Extract<SimEvent, { type: T }> | undefined;
const hasMark = (events: readonly SimEvent[], id: string): SimEvent | undefined => events.find((e) => e.type === 'mark' && e.id === id);

const FIVE_SECONDS = 300;

const withStat = (base: string, stats: PredictionStats, what: string): string =>
  stats.attempts === 0 ? `${base} (No data on you yet. Going with instinct.)` : `${base} (${stats.repeats} of your ${stats.attempts} attempt${stats.attempts === 1 ? '' : 's'} ${what}.)`;

/** `ended`: the attempt is over (death, restart or win), so anything still undecided is void. `now` is the attempt's tick. */
export function derivePredictions(levelN: number, events: readonly SimEvent[], ended: boolean, now: number, stats: PredictionStats): PredictionResult[] {
  const out: PredictionResult[] = [];
  const decide = (id: string, text: string, verdict: Verdict | null, tick: number | null): void => {
    out.push({ id, text, verdict: verdict ?? (ended ? 'void' : null), tick: verdict ? tick : ended ? now : null });
  };
  const death = first(events, 'death');
  const win = first(events, 'win');

  if (levelN === 1) {
    const btn = first(events, 'button');
    const mid = hasMark(events, 'mid');
    if (btn) decide('l1-press', withStat('I predict you will press that button.', stats, 'did'), 'correct', btn.t);
    else if (mid) decide('l1-press', withStat('I predict you will press that button.', stats, 'did'), 'wrong', mid.t);
    else decide('l1-press', withStat('I predict you will press that button.', stats, 'did'), null, null);
    const past = hasMark(events, 'past');
    if (death && death.cause === 'drop') decide('l1-spikes', 'I predict you will walk straight into the falling spikes.', 'correct', death.t);
    else if (past || win) decide('l1-spikes', 'I predict you will walk straight into the falling spikes.', 'wrong', (past ?? win)!.t);
    else decide('l1-spikes', 'I predict you will walk straight into the falling spikes.', null, null);
  } else if (levelN === 2) {
    const text = withStat('I predict you will jump too early.', stats, 'did');
    // The first jump from the ground after the starting area. "Early" is before x = 8, the same line the vents use.
    const jump = events.find((e) => e.type === 'takeoff' && e.x >= 2) as Extract<SimEvent, { type: 'takeoff' }> | undefined;
    if (jump) decide('l2-early', text, jump.x < 8 ? 'correct' : 'wrong', jump.t);
    else decide('l2-early', text, null, null);
  } else if (levelN === 3) {
    const star = first(events, 'star');
    const text = 'I predict you will not survive five seconds after taking the star.';
    if (!star) decide('l3-star', text, null, null);
    else if (death && death.t <= star.t + FIVE_SECONDS) decide('l3-star', text, 'correct', death.t);
    else if (now > star.t + FIVE_SECONDS || win) decide('l3-star', text, 'wrong', star.t + FIVE_SECONDS);
    else decide('l3-star', text, null, null);
  } else {
    // Levels 4 and 5: every locked beam is a prediction of where you will be.
    const locks = ticksOf(events, 'beam_lock') as Extract<SimEvent, { type: 'beam_lock' }>[];
    const ends = ticksOf(events, 'beam_end') as Extract<SimEvent, { type: 'beam_end' }>[];
    locks.forEach((lk, i) => {
      const end = ends[i];
      const text = `Target locked: x = ${lk.aim.toFixed(1)}.`;
      if (end) decide(`beam-${i + 1}`, text, end.hit ? 'correct' : 'wrong', end.t);
      else decide(`beam-${i + 1}`, text, null, null);
    });
    if (levelN === 5) {
      const text = 'I predict you will never reach that button.';
      if (win) decide('l5-button', text, 'wrong', win.t);
      else decide('l5-button', text, null, null);
    }
  }
  return out;
}

export interface LedgerEntry {
  level: number;
  attempt: number;
  id: string;
  verdict: Verdict;
  tick: number;
}

/** Every verdict the host has earned, kept in order. Counts are always derived from the entries, never stored separately. */
export class PredictionLedger {
  readonly entries: LedgerEntry[] = [];
  private readonly seen = new Set<string>();

  /** Adds the verdicts that are newly decided. Returns them so the host can react once to each. */
  record(level: number, attempt: number, results: readonly PredictionResult[]): LedgerEntry[] {
    const added: LedgerEntry[] = [];
    for (const r of results) {
      if (r.verdict === null) continue;
      const key = `${level}:${attempt}:${r.id}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      const e: LedgerEntry = { level, attempt, id: r.id, verdict: r.verdict, tick: r.tick ?? 0 };
      this.entries.push(e);
      added.push(e);
    }
    return added;
  }

  counts(level?: number): { correct: number; wrong: number; void: number; beams: number } {
    const list = level === undefined ? this.entries : this.entries.filter((e) => e.level === level);
    return {
      correct: list.filter((e) => e.verdict === 'correct').length,
      wrong: list.filter((e) => e.verdict === 'wrong').length,
      void: list.filter((e) => e.verdict === 'void').length,
      /** How many of the decided ones were beam aims (each locked beam is a prediction of where you will be). */
      beams: list.filter((e) => e.id.startsWith('beam-') && e.verdict !== 'void').length,
    };
  }
}
