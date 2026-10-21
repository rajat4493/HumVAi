import type { GameAction, GameEvent, Phase } from '@hva/game-core';

export const SCHEMA_RUN = 'hva.run.1';

export interface ModelIdentity {
  provider: string;
  /** Exact API model string used for the call. */
  modelId: string;
  snapshot?: string | null;
  displayName: string;
}

/** Recorded verbatim; nothing is hidden or tuned per level. */
export interface SamplingConfig {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number | null;
  reasoning?: { mode: 'default' | 'off' | 'on'; effort?: string };
  seed?: number;
  extra?: Record<string, string | number | boolean>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DecisionRequest {
  schemaVersion: 'hva.turn.1';
  system: string;
  messages: ChatMessage[];
  limits: { maxOutputTokens: number | null; timeoutMs: number };
}

export interface CallUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
}

export interface DecisionResponse {
  /** Exact provider text; parsed (and distrusted) by the runner. */
  raw: string;
  usage: CallUsage;
  latencyMs: number;
  providerRequestId: string | null;
  finishReason: string;
  /** Model name the API says it served (may differ from the requested alias). */
  respondedModel: string | null;
  /** Transport-level retries performed inside the adapter. */
  retries: number;
}

export type AdapterErrorKind = 'transport' | 'rate_limit' | 'auth' | 'provider' | 'context_overflow' | 'timeout';

export class AdapterError extends Error {
  constructor(
    readonly kind: AdapterErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export interface ModelAdapter {
  readonly identity: ModelIdentity;
  readonly sampling: SamplingConfig;
  decide(req: DecisionRequest, signal?: AbortSignal): Promise<DecisionResponse>;
}

export interface CallMetrics {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  latencyMs: number;
  finishReason: string;
  providerRequestId: string | null;
  respondedModel: string | null;
  retries: number;
}

export interface StepRecord {
  i: number;
  phase: Phase;
  /** Hash of the observation shown to the model for this call. */
  obsHash: string;
  /** Null when the reply could not be parsed into an action. */
  action: GameAction | null;
  valid: boolean;
  rejection: string | null;
  events: GameEvent[];
  note: string | null;
  call: CallMetrics;
}

export type AttemptStatus = 'won' | 'lost' | 'forfeit' | 'void';

export interface RunOutcome {
  status: AttemptStatus;
  voidReason: string | null;
  scoutActions: number;
  runActions: number;
  rejectedActions: number;
  finalStateHash: string;
}

export interface RunTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  costUsd: number | null;
  wallMs: number;
}

export interface RunRecord {
  schema: typeof SCHEMA_RUN;
  attemptId: string;
  challengeId: string;
  challengeVersion: number;
  seed: string;
  condition: 'A';
  model: ModelIdentity;
  sampling: SamplingConfig;
  configHash: string;
  promptHash: string;
  runnerVersion: string;
  engineVersion: string;
  startedAt: string;
  finishedAt: string;
  steps: StepRecord[];
  outcome: RunOutcome;
  totals: RunTotals;
  flags: string[];
}

/** One line of calls.jsonl: what was sent and received, never headers or keys. */
export interface CallLog {
  attemptId: string;
  i: number;
  userMessage: string;
  rawResponse: string;
}

export interface PriceEntry {
  /** US dollars per million tokens. */
  inputPerMTok: number;
  outputPerMTok: number;
  cachedInputPerMTok?: number;
}
export type PriceTable = Record<string, PriceEntry>;
