import type { ChallengeDefinition } from '@hva/game-core';
import { create, step } from '@hva/game-core';
import { median } from './stats';
import type { ModelIdentity, RunRecord } from './types';
import { verifyRecord } from './verify';

export const SCHEMA_OPPONENT = 'hva.opponent.1';

export interface AttemptSummary {
  attempt: number;
  status: RunRecord['outcome']['status'];
  runActions: number;
  scoutActions: number;
}

/**
 * What the game ships for a world: one replay-verified attempt chosen by a published rule,
 * plus the honest context (how all the recorded attempts went).
 */
export interface OpponentRecording {
  schema: typeof SCHEMA_OPPONENT;
  challengeId: string;
  challengeVersion: number;
  /** 'model' = a real model through the runner. 'reference' = a computed/scripted player, never to be presented as an AI. */
  kind: 'model' | 'reference';
  model: ModelIdentity;
  recordedAt: string;
  configHash: string;
  promptHash: string;
  attempts: AttemptSummary[];
  /** Which attempt (1-based, matches `attempts[].attempt`) is shown. */
  shownAttempt: number;
  selection: 'median-success' | 'closest-failure';
  shown: RunRecord;
  /** Tokens, latency and cost measured while recording (never shown during replay). */
  measured: { calls: number; inputTokens: number; outputTokens: number; costUsd: number | null; wallMs: number; latencyMsP50: number | null };
}

/** Shortest walking distance (ignoring doors and blocks) from a tile to the exit: used to rank failed attempts. */
export function gridDistanceToExit(level: ChallengeDefinition, from: { x: number; y: number }): number {
  const rows = level.map;
  let exit: { x: number; y: number } | null = null;
  rows.forEach((r, y) => {
    const x = r.indexOf('E');
    if (x >= 0) exit = { x, y };
  });
  if (!exit) return Infinity;
  const e: { x: number; y: number } = exit;
  const seen = new Set<string>([`${from.x},${from.y}`]);
  let frontier = [{ ...from }];
  for (let d = 0; frontier.length > 0; d++) {
    const next: typeof frontier = [];
    for (const p of frontier) {
      if (p.x === e.x && p.y === e.y) return d;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const q = { x: p.x + dx, y: p.y + dy };
        const k = `${q.x},${q.y}`;
        if (seen.has(k) || rows[q.y]?.[q.x] === undefined || rows[q.y]?.[q.x] === '#') continue;
        seen.add(k);
        next.push(q);
      }
    }
    frontier = next;
  }
  return Infinity;
}

function finalPosition(level: ChallengeDefinition, r: RunRecord): { x: number; y: number } {
  const s = create(level, r.seed);
  for (const st of r.steps) if (st.action) step(s, st.action);
  return s.player;
}

export interface Selection {
  index: number;
  rule: OpponentRecording['selection'];
}

/**
 * The published selection rule, fixed before any data: among attempts that reached the exit, the one with the
 * median run length (lower median for an even count; ties go to the lowest attempt number). If none did, the
 * attempt whose final position was nearest the exit (ties: lowest attempt number), labelled unsuccessful.
 * Voids and unverified records never take part. Returns the index into `records`.
 */
export function selectShownAttempt(records: RunRecord[], level: ChallengeDefinition): Selection | null {
  const eligible = records.map((r, index) => ({ r, index })).filter((x) => x.r.outcome.status !== 'void' && verifyRecord(x.r, level).ok);
  if (eligible.length === 0) return null;
  const wins = eligible.filter((x) => x.r.outcome.status === 'won');
  if (wins.length > 0) {
    const m = median(wins.map((x) => x.r.outcome.runActions)) as number;
    const pick = wins.find((x) => x.r.outcome.runActions === m) as (typeof wins)[number];
    return { index: pick.index, rule: 'median-success' };
  }
  const ranked = [...eligible].sort((a, b) => gridDistanceToExit(level, finalPosition(level, a.r)) - gridDistanceToExit(level, finalPosition(level, b.r)) || a.index - b.index);
  return { index: (ranked[0] as (typeof eligible)[number]).index, rule: 'closest-failure' };
}

/** Builds the shippable recording from verified records of ONE (model, config, world). */
export function buildOpponent(records: RunRecord[], level: ChallengeDefinition, opts: { kind: 'model' | 'reference'; now: Date }): OpponentRecording | null {
  const first = records[0];
  if (!first) return null;
  const same = records.every((r) => r.challengeId === level.id && r.challengeVersion === level.version && r.configHash === first.configHash);
  if (!same) throw new Error('records must all be for the same world version and configuration');
  const sel = selectShownAttempt(records, level);
  if (!sel) return null;
  const counted = records.filter((r) => r.outcome.status !== 'void' && verifyRecord(r, level).ok);
  const attempts: AttemptSummary[] = counted.map((r, i) => ({ attempt: i + 1, status: r.outcome.status, runActions: r.outcome.runActions, scoutActions: r.outcome.scoutActions }));
  const shown = records[sel.index] as RunRecord;
  const shownAttempt = counted.indexOf(shown) + 1;
  const lat = shown.steps.map((s) => s.call.latencyMs).sort((a, b) => a - b);
  return {
    schema: SCHEMA_OPPONENT,
    challengeId: level.id,
    challengeVersion: level.version,
    kind: opts.kind,
    model: first.model,
    recordedAt: shown.finishedAt || opts.now.toISOString(),
    configHash: first.configHash,
    promptHash: first.promptHash,
    attempts,
    shownAttempt,
    selection: sel.rule,
    shown,
    measured: {
      calls: shown.totals.calls,
      inputTokens: shown.totals.inputTokens,
      outputTokens: shown.totals.outputTokens,
      costUsd: shown.totals.costUsd,
      wallMs: shown.totals.wallMs,
      latencyMsP50: lat.length ? (lat[Math.floor((lat.length - 1) / 2)] as number) : null,
    },
  };
}

export interface OpponentCheck {
  ok: boolean;
  errors: string[];
}

/** Everything the UI relies on, re-checked at load time: a failed check means "inconclusive", never a result. */
export function checkOpponent(o: unknown, level: ChallengeDefinition): OpponentCheck {
  const errors: string[] = [];
  const bad = (m: string) => errors.push(m);
  if (typeof o !== 'object' || o === null) return { ok: false, errors: ['not an object'] };
  const r = o as OpponentRecording;
  if (r.schema !== SCHEMA_OPPONENT) bad('unknown schema');
  if (r.challengeId !== level.id) bad('recording is for a different world');
  if (r.challengeVersion !== level.version) bad(`recording is for version ${String(r.challengeVersion)}, the world is version ${level.version}`);
  if (r.kind !== 'model' && r.kind !== 'reference') bad('kind must be model or reference');
  if (r.kind === 'reference' && !/not an AI/i.test(r.model?.displayName ?? '')) bad('a reference player must be labelled "not an AI"');
  if (r.kind === 'model' && /not an AI|reference|scripted|random/i.test(`${r.model?.displayName} ${r.model?.provider}`)) bad('a model recording cannot carry a reference/test identity');
  if (!r.shown || !Array.isArray(r.attempts) || r.attempts.length === 0) {
    bad('missing attempts or shown record');
    return { ok: false, errors };
  }
  const v = verifyRecord(r.shown, level);
  if (!v.ok) bad(`shown attempt failed replay verification: ${v.errors[0]}`);
  const summary = r.attempts[r.shownAttempt - 1];
  if (!summary || summary.runActions !== r.shown.outcome.runActions || summary.status !== r.shown.outcome.status) bad('shown attempt does not match its summary');
  if (r.shown.outcome.status !== 'won' && r.shown.outcome.status !== 'lost') bad('shown attempt must be a completed win or loss');
  if (r.selection === 'median-success') {
    const wins = r.attempts.filter((a) => a.status === 'won').map((a) => a.runActions);
    if (r.shown.outcome.status !== 'won' || r.shown.outcome.runActions !== median(wins)) bad('shown attempt does not follow the published selection rule');
  } else if (r.attempts.some((a) => a.status === 'won')) bad('closest-failure is only allowed when no attempt succeeded');
  return { ok: errors.length === 0, errors };
}
