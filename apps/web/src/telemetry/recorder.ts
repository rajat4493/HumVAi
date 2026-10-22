import type { GameAction } from '@hva/game-core';
import type { KV } from '../save/store';
import { CONSENT_KEY, POLICY_VERSION, STORE_KEY, TELEMETRY_SCHEMA } from './types';
import type { Consent, TAction, TAttempt, TelemetryFile, TOutcome } from './types';

export const MAX_ATTEMPTS = 300;
export const MAX_BYTES = 1_500_000;

export interface RecorderDeps {
  kv: KV;
  /** Epoch milliseconds. */
  now: () => number;
  /** Monotonic milliseconds (performance.now). */
  tick: () => number;
  id: () => string;
  appVersion: string;
}

const round10 = (ms: number): number => Math.round(ms / 10) * 10;
const hourOf = (epoch: number): string => `${new Date(epoch).toISOString().slice(0, 13)}:00:00Z`;
const dayOf = (epoch: number): string => new Date(epoch).toISOString().slice(0, 10);

/**
 * Opt-in, local-only gameplay recorder. With consent off (the default) it does nothing at all: no storage writes, no
 * memory of attempts. With consent on it keeps attempts on this device only; the player can download or delete them.
 * There is deliberately no upload path here: collecting data anywhere else needs an approved data policy first.
 */
export class TelemetryRecorder {
  private attempts: TAttempt[] = [];
  private current: { attempt: TAttempt; began: number } | null = null;
  private listeners = new Set<() => void>();
  private consent: Consent | null;

  constructor(private readonly d: RecorderDeps) {
    this.consent = this.readConsent();
    if (this.consent?.granted) this.attempts = this.readAttempts();
  }

  get enabled(): boolean {
    return this.consent?.granted === true;
  }
  get count(): number {
    return this.attempts.length + (this.current ? 1 : 0);
  }
  get consentInfo(): Consent | null {
    return this.consent;
  }

  setConsent(granted: boolean): void {
    this.consent = { granted, at: dayOf(this.d.now()), policyVersion: POLICY_VERSION };
    this.write(CONSENT_KEY, JSON.stringify(this.consent));
    if (!granted) this.clear();
    else this.attempts = this.readAttempts();
    this.emit();
  }

  beginAttempt(args: { levelId: string; levelVersion: number; startHash: string; device: 'touch' | 'pointer'; prefix?: GameAction[] }): void {
    if (!this.enabled) return;
    this.abandon();
    const attempt: TAttempt = {
      id: this.d.id(),
      levelId: args.levelId,
      levelVersion: args.levelVersion,
      startedAt: hourOf(this.d.now()),
      device: args.device,
      prefix: args.prefix ? [...args.prefix] : [],
      start: args.startHash,
      actions: [],
      hints: [],
      outcome: null,
    };
    this.current = { attempt, began: this.d.tick() };
    this.emit();
  }

  recordAction(a: { action: GameAction; phase: TAction['phase']; events: string[]; hash: string }): void {
    const c = this.current;
    if (!this.enabled || !c) return;
    c.attempt.actions.push({ i: c.attempt.actions.length, t: round10(this.d.tick() - c.began), phase: a.phase, a: a.action, ev: a.events, h: a.hash });
  }

  recordHint(tier: number): void {
    const c = this.current;
    if (!this.enabled || !c) return;
    c.attempt.hints.push({ tier, t: round10(this.d.tick() - c.began), atAction: c.attempt.actions.length });
  }

  endAttempt(outcome: Omit<TOutcome, 'durationMs' | 'assisted'> & { assisted?: boolean }): void {
    const c = this.current;
    if (!this.enabled || !c) return;
    c.attempt.outcome = { ...outcome, assisted: outcome.assisted ?? c.attempt.hints.length > 0, durationMs: round10(this.d.tick() - c.began) };
    this.attempts.push(c.attempt);
    this.current = null;
    this.persist();
    this.emit();
  }

  /** The player left or restarted without finishing. Kept (it shows where people give up) unless it never had an action. */
  abandon(): void {
    const c = this.current;
    if (!c) return;
    this.current = null;
    if (!this.enabled || c.attempt.actions.length === 0) return;
    const resets = (phase: 'explore' | 'execute') => c.attempt.actions.filter((x) => x.phase === phase && x.a.type === 'RESET').length;
    c.attempt.outcome = {
      status: 'abandoned',
      runActions: c.attempt.actions.filter((x) => x.phase === 'execute' && x.a.type !== 'RESET').length,
      scoutActions: c.attempt.actions.filter((x) => x.phase === 'explore' && x.a.type !== 'RESET' && x.a.type !== 'COMMIT').length,
      scoutResets: resets('explore'),
      runResets: resets('execute'),
      assisted: c.attempt.hints.length > 0,
      durationMs: round10(this.d.tick() - c.began),
    };
    this.attempts.push(c.attempt);
    this.persist();
    this.emit();
  }

  export(): TelemetryFile {
    const live = this.current && this.current.attempt.actions.length > 0 ? [{ ...this.current.attempt }] : [];
    return { schema: TELEMETRY_SCHEMA, policyVersion: this.consent?.policyVersion ?? POLICY_VERSION, appVersion: this.d.appVersion, exportedAt: dayOf(this.d.now()), attempts: [...this.attempts, ...live] };
  }

  /** Erases everything this recorder holds, here and in storage. Consent itself is left as it is. */
  clear(): void {
    this.attempts = [];
    this.current = null;
    try {
      this.d.kv.removeItem(STORE_KEY);
    } catch {
      /* nothing to remove */
    }
    this.emit();
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  private persist(): void {
    let kept = this.attempts.slice(-MAX_ATTEMPTS);
    let text = JSON.stringify({ schema: TELEMETRY_SCHEMA, attempts: kept });
    while (text.length > MAX_BYTES && kept.length > 1) {
      kept = kept.slice(Math.ceil(kept.length / 10));
      text = JSON.stringify({ schema: TELEMETRY_SCHEMA, attempts: kept });
    }
    this.attempts = kept;
    this.write(STORE_KEY, text);
  }

  private write(key: string, value: string): void {
    try {
      this.d.kv.setItem(key, value);
    } catch {
      /* storage full or blocked: keep recording in memory for this tab */
    }
  }

  private readConsent(): Consent | null {
    try {
      const raw = this.d.kv.getItem(CONSENT_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw) as Partial<Consent>;
      return typeof v.granted === 'boolean' && typeof v.at === 'string' && typeof v.policyVersion === 'string' ? (v as Consent) : null;
    } catch {
      return null;
    }
  }

  private readAttempts(): TAttempt[] {
    try {
      const raw = this.d.kv.getItem(STORE_KEY);
      if (!raw) return [];
      const v = JSON.parse(raw) as { schema?: string; attempts?: unknown };
      return v.schema === TELEMETRY_SCHEMA && Array.isArray(v.attempts) ? (v.attempts as TAttempt[]) : [];
    } catch {
      return [];
    }
  }
}
