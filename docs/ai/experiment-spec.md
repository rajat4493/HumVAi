# AI competition experiment — specification (Task 1; nothing here is implemented)

Purpose: find out how a real language model actually performs on the five existing worlds when it plays through the same engine, with the same information and budgets as a human. This is a **measurement**, not a demo. Its results decide how hard the worlds must become before M1 content is scaled (audit risk G1: "the worlds may be trivial for an LLM").

## 0. Questions and non-goals

| Question | Measured by |
|---|---|
| Q1 Can the model win each world, and how reliably? | success count k of 10, Wilson interval |
| Q2 How efficiently (run actions vs optimal)? | run actions, ratio to the solver's optimum |
| Q3 Does it scout informatively (tests decoys, finds the rune, discovers the jam) or does it rush? | deterministic *discovery events* computed from the log (§12) |
| Q4 What does an attempt cost and how long does it take? | tokens, money, latency per call and per attempt |
| Q5 Is every result reproducible from its record? | replay verification pass rate (must be 100%) |

Non-goals: no tuning of prompts per level, no hints, no difficulty handicaps of any kind, no human comparison (that is playtesting), no UI, no real-time play.

## 1. Fairness principles

1. **Same game.** Same world definition and version, same Scout budget `E` and Run budget `X`, same actions, same hidden rules (never disclosed), same rejection semantics, same scoring. The engine enforces all of it.
2. **Same information.** The model sees exactly `observe()` output plus the events produced by its last action plus `legalActions()`; the human's UI is rendered from the same object. Nothing the human can perceive is withheld from the model, and nothing else is given to it.
3. **No handicaps.** No reduced budgets, no artificial noise, no forced delays, no restricted reasoning effort, no token cap that could cut off reasoning in a way a human is not cut off. The only limits are operational and chosen so they do not bind normal play (§6); any attempt that hits one is flagged and reported, never silently scored as a loss for skill.
4. **No help.** No level-specific prompt text, no examples of solutions, no solver output, no prior attempts (each attempt is independent). The briefing text is the same string the human reads.
5. **Declared, unscored differences:** modality (structured text vs pixels), memory (the model's context transcript, including its Scout, vs the human's head), speed, prior exposure. These are listed in every report.
6. **Parity manual.** The generic "how to play" text given to the model (actions, phases, budgets) is also shown to humans as a How-to-play panel (decision D3), so neither side has rules the other lacks.

## 2. Components

```
level definitions ──▶ Runner ──▶ ModelAdapter ──▶ provider API
                        │  ▲
        engine (game-core) ┘  └── validates & executes each proposed action
                        │
                        ▼
              Store (JSONL RunRecords + calls ledger)
                        │
          ┌─────────────┴─────────────┐
     Replay verifier              Reporter (aggregates, CIs, cost)
```
Proposed placement (decision D1): `packages/ai-adapters` (interface, prompt builder, adapters, scripted test adapter) and `apps/runner` (CLI). Both depend on `@hva/game-core` and nothing else in the monorepo; nothing in `game-core` changes except possibly exporting the existing prompt-safe pieces.

## 3. Provider-neutral model interface

```ts
interface ModelIdentity {
  provider: string;            // e.g. "anthropic", "openai", "google", "local"
  modelId: string;             // exact API model string used for the call
  snapshot?: string;           // dated/versioned identifier if the provider exposes one
  displayName: string;         // what the UI may show
}

interface SamplingConfig {      // recorded verbatim, nothing hidden
  temperature?: number; topP?: number; maxOutputTokens?: number;
  reasoning?: { mode: 'default' | 'off' | 'on'; effort?: string };   // provider-specific, passed through
  seed?: number;               // only if the provider supports it
  extra?: Record<string, string | number | boolean>;
}

interface DecisionRequest {
  schemaVersion: 'hva.turn.1';
  system: string;                       // generic rules prompt (§5), identical for every level
  history: Turn[];                      // all previous observations/replies in this attempt (incl. Scout)
  observation: PublicGameStateV1;       // §4.1
  lastEvents: GameEvent[];
  legalActions: GameAction[];
  limits: { maxOutputTokens: number | null; timeoutMs: number };
}

interface DecisionResponse {
  action: unknown;                      // parsed but NOT trusted; the runner validates against §4.2
  note?: string;                        // optional one-sentence self-reported explanation
  raw: string;                          // exact provider text/tool payload, stored for audit
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens?: number; reasoningTokens?: number };
  latencyMs: number;                    // wall-clock for this call, measured by the runner
  providerRequestId?: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error' | 'other';
}

interface ModelAdapter {
  readonly identity: ModelIdentity;
  readonly sampling: SamplingConfig;
  decide(req: DecisionRequest, signal: AbortSignal): Promise<DecisionResponse>;   // throws AdapterError{kind:'transport'|'rate_limit'|'auth'|'provider'}
}
```
Adapters translate this to whatever the provider offers (tool/function call, JSON mode, or plain JSON text). Adapters may not add information, reorder history, or alter the prompt; a contract test compares the exact messages an adapter sends against a golden snapshot. A **scripted adapter** (plays a fixed action list) and a **random adapter** exist for harness tests and are always labelled as such in reports.

## 4. Exact schemas (all versioned; a change bumps the version)

### 4.1 Observation (`hva.obs.1`) = the engine's `PublicGameState`, unchanged
```json
{
  "challengeId": "string", "version": 2, "width": 9, "height": 5,
  "tiles": ["#########", "..."],                      // '#' wall, '.' floor; one string per row
  "player": {"x": 1, "y": 1}, "exit": {"x": 7, "y": 1},
  "entities": [ {"id": "door-garden", "kind": "door|switch|plate|block|tripwire",
                 "pos": {"x": 4, "y": 2},
                 "state": "open|closed|on|off|pressed|idle|armed|spent|static"} ],
  "phase": "explore|execute",
  "scout": {"budget": 16, "used": 0}, "run": {"budget": 12, "used": 0},
  "actionsRemaining": 16,                              // in the current phase
  "epoch": 0, "status": "playing|won|lost"
}
```
The turn message also contains the ASCII rendering (`renderAscii`) of the same state (redundant, for legibility) and the previous action's events. Hidden rules, level source, solver data, internal state and the optimal length are never included. A CI test asserts the serialized message contains none of the hidden-rule keys (existing observability tests extend to the final message text).

### 4.2 Action (`hva.act.1`)
```json
{ "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    { "type": "object", "required": ["type", "direction"], "additionalProperties": false,
      "properties": { "type": {"const": "MOVE"}, "direction": {"enum": ["UP","DOWN","LEFT","RIGHT"]} } },
    { "type": "object", "required": ["type", "targetId"], "additionalProperties": false,
      "properties": { "type": {"const": "INTERACT"}, "targetId": {"type": "string"} } },
    { "type": "object", "required": ["type"], "additionalProperties": false, "properties": { "type": {"const": "RESET"} } },
    { "type": "object", "required": ["type"], "additionalProperties": false, "properties": { "type": {"const": "COMMIT"} } }
  ] }
```
### 4.3 Model reply (`hva.reply.1`)
```json
{ "action": { "type": "MOVE", "direction": "RIGHT" },
  "note": "One short sentence, optional (max 200 characters)." }
```
Parsing rule: the reply must be one JSON object (extra whitespace or a fenced block tolerated; nothing else). Anything else is a **malformed reply** → treated as a rejected action (free, counted) with the engine-style message returned to the model: `"REJECTED: <reason>"`. The model is never told what would have been correct.

### 4.4 Record (`hva.run.1`), one JSON object per attempt, JSONL
```json
{ "schema": "hva.run.1", "attemptId": "w03-locked-garden@2/anthropic:claude-sonnet-5-5/cfg-9f3a/a07",
  "challengeId": "w03-locked-garden", "challengeVersion": 2, "seed": "exp1-a07",
  "condition": "A",
  "model": { "provider": "...", "modelId": "...", "snapshot": null, "displayName": "..." },
  "sampling": { }, "configHash": "sha256:...",
  "promptHash": "sha256:...", "runnerVersion": "git:<sha>", "engineVersion": "git:<sha>",
  "startedAt": "ISO-8601", "finishedAt": "ISO-8601",
  "steps": [ { "i": 0, "phase": "explore", "obsHash": "fnv:...", "action": {}, "valid": true,
               "events": [], "note": null,
               "call": { "inputTokens": 0, "outputTokens": 0, "cachedInputTokens": 0, "reasoningTokens": null,
                         "latencyMs": 0, "finishReason": "stop", "providerRequestId": null, "retries": 0 } } ],
  "outcome": { "status": "won|lost|forfeit|void", "voidReason": null,
               "scoutActions": 0, "runActions": 0, "rejectedActions": 0, "finalStateHash": "..." },
  "totals": { "calls": 0, "inputTokens": 0, "outputTokens": 0, "costUsd": null, "wallMs": 0 },
  "flags": [] }
```
The raw provider payloads go to a separate append-only `calls.jsonl` keyed by `attemptId`+`i` (they can be large and may contain provider-internal text); the record carries hashes of them.

## 5. Prompt (frozen text; versioned; hashed into the config)

**System prompt (identical for every world and model):**
```
You are playing a small puzzle game by choosing one action at a time.
Each turn you receive the current state of the world, what your last action caused, and the actions
that are legal right now. Reply with exactly one JSON object: {"action": <action>, "note": <optional short sentence>}.

The world is a grid. '#' is wall, '.' is floor, '@' is you, 'E' is the exit. Other things are listed
as entities with an id, a kind and a state. Some of how this world behaves is not told to you. You can
only find out by acting and watching what happens.

Actions:
- MOVE with direction UP, DOWN, LEFT or RIGHT: move one tile. If something blocks you, you stay where you are
  (it still counts as an action). Walking into a block pushes it one tile if there is room.
- INTERACT with targetId: acts on an adjacent switch (toggles it) or an adjacent block (drags it: you step
  directly away and it follows). Only things next to you can be targeted.
- RESET: put the world back to how it started.
- COMMIT: only while scouting. Ends scouting and starts the run.

The game has two phases. Scout: a practice world where nothing can be won or lost; RESET is free; you have a
limited number of actions. The Run: a fresh world, strict action limit, RESET costs one action. You win by
reaching the exit during the Run. Reaching the exit while scouting ends scouting and starts the Run.
What you learned while scouting is yours to use in the Run; the world itself is reset.
Your goal: reach the exit during the Run using as few actions as you can.
```
**Per-turn user message:** `BRIEFING` (the level's briefing string, same as the human's), `PHASE / BUDGETS`, `OBSERVATION` (JSON), `BOARD` (ASCII), `LAST ACTION RESULT` (events or `none`), `LEGAL ACTIONS` (JSON list). **History:** all previous turns (observation + reply) of this attempt are retained in order, including the whole Scout. No summarization, no truncation (a context-window overflow voids the attempt and is reported; it is not scored). Prompt caching is allowed (it changes cost, not content).

## 6. Budgets and limits

| Quantity | Value | Why |
|---|---|---|
| Scout budget `E`, Run budget `X` | exactly the level's values (`w01` 0/12, `w02` 16/12, `w03` 24/14, `w04` 14/11, `w05` 20/16) | parity with the human |
| Max accepted actions | `E + X` (engine-enforced; cannot be exceeded) | |
| Max rejected actions | 20 per attempt, then the attempt ends as `forfeit` | stops runaway loops; humans cannot produce rejected actions |
| Max model calls per attempt | `E + X + 20 + 10` retries | cost guard |
| Per-call timeout | 300 s (generous so reasoning is not cut) | operational |
| Max output tokens | provider maximum for the model (not a difficulty lever) | no handicap |
| Spend cap per experiment | set by the operator before the run; the runner stops cleanly at 90% | cost guard |

Operational events (context overflow, timeout, repeated provider errors, safety refusal) set `outcome.status = "void"` with a reason, the attempt is re-run up to 3 times, and every void is reported with its count. A void is never counted as a loss and never hidden.

## 7. Model identification and configuration

- Every record stores `ModelIdentity`, `SamplingConfig`, `promptHash`, runner/engine git hashes and a `configHash = sha256(canonical JSON of those)`. Two attempts are only aggregated if their `configHash` match.
- Sampling: each model runs at the **provider's recommended defaults** for interactive use, with reasoning/"thinking" **on at the provider default** where offered (decision D4: no handicap means we do not turn reasoning off). Nothing is tuned per level. The values are written to the report.
- Roster (decision D2): at least two providers, so conclusions are not about one vendor. Candidates available in this environment: `claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`. Non-Anthropic models are to be named by you; I have not verified their identifiers or pricing and will not invent them. A smaller and a larger model from the same family are useful to see whether capability moves success.
- Model identity as reported by the API (not only the requested string) is stored when the provider returns it; a mismatch flags the attempt.

## 8. Ten independent runs per level

Per (model, configHash, world, condition): attempts `a01…a10`.
- **Independent** = new conversation, no shared memory or caches of *content* across attempts (prefix caching of identical text is fine), attempt-specific world seed `exp1-aNN` (the worlds are handcrafted so the seed does not change them today, but it is recorded for when variants exist), and sampling seeds where the provider supports them.
- **Order:** attempts are interleaved across worlds and models in a seeded random order, to spread provider-side drift and rate limits.
- **Condition:** `A` = current design (same layout in Scout and Run). Condition `B` runs are specified in `docs/product/scout-run-evaluation.md` and are optional.
- **Counts:** 5 worlds × 10 attempts = 50 per model per condition. World 1 has no Scout.
- **Stopping:** all 10 must end `won`, `lost`, or `forfeit` (voids re-run). We do not stop early or add attempts after seeing results.

## 9. Execution protocol (per attempt)

```
engine = create(level, seed)
repeat until engine.status != 'playing':
    msg = buildTurn(history, observe(engine), lastEvents, legalActions(engine))
    resp = adapter.decide(msg)                       # retries only transport/rate-limit errors, identical request, max 3
    action = parseReply(resp.raw)                    # malformed → rejected action
    result = step(engine, action)                    # engine validates; rejected actions are free and counted
    append step { obsHash(before), action, valid, events, note, call metrics }
record outcome from engine.evaluate()
```
The model never touches the engine; it cannot see or alter anything but its reply.

## 10. Deterministic replay verification

A model is non-deterministic, so *regenerating* a run is not the test. Reproducibility means **the record re-executes exactly**:
1. Re-create the level at `challengeVersion`; verify `challengeVersion` and `engineVersion` are known.
2. For each step `i`, recompute `obsHash` of the observation the engine produces *before* the action and compare to the stored one (proves the model was shown exactly what the engine would have shown).
3. Execute the stored action; compare `valid` and the event list.
4. Compare final `outcome` and `finalStateHash` with `replay(challenge, actions)`.
5. Check totals: scout/run counts, rejected count, budget never exceeded, no actions after the end.
Any mismatch → the record is marked `unverified` and excluded from all statistics (and listed). Acceptance: 100% of included records verify; the verifier is run as a separate CLI (`verify-runs`), also over a deliberately corrupted fixture to prove it can fail.

## 11. Cost and latency tracking

Per call: input/output/cached/reasoning tokens (as reported by the provider), measured wall latency, retries, request id. Per attempt and per experiment: sums, and **cost computed from an operator-supplied versioned price table** (`prices.json`: model → $/Mtok input, cached input, output; I do not hard-code prices). Reports show median/p90 latency per call, per attempt wall time, tokens and cost per attempt, per world, per model, and cost per *successful* attempt.

Measured sizing (from the real prompt builder on the real levels; tokens ≈ characters/3.5; an estimate, not a bill):

| World | avg turn message | worst-case turns | input tokens per attempt, no caching | output tokens at ~40/turn |
|---|---|---|---|---|
| 1 | ~180 tok | 12 | 28k | 0.5k |
| 2 | ~280 | 28 | 151k | 1.1k |
| 3 | ~285 | 38 | 268k | 1.5k |
| 4 | ~305 | 25 | 133k | 1.0k |
| 5 | ~335 | 36 | 276k | 1.4k |

One model, 10 attempts per world, all attempts using every action, no caching: **≈ 8.6M input tokens**. Real attempts end earlier and prefix caching cuts billed input a lot; with reasoning on, output may be 10–100× the 40-token floor (≈ 0.5M–5M output tokens per model). Run a 1-attempt-per-world dry run first and extrapolate before paying for 50.

## 12. Scoring, ties and derived measures

Per attempt (engine, authoritative): `won`, `runActions`, `scoutActions`, `rejectedActions`; `optimal` from the solver; `waste = runActions − optimal` (wins only).

Per (model, world): `k` of 10 won (Wilson 95% interval), median/min/max `runActions` over wins, median `scoutActions`, median `waste`, `forfeits`, `voids`. Resolution of ten runs: 0/10 → ≤28%, 5/10 → 24–76%, 10/10 → ≥72%. Claims will be worded accordingly ("at least 72%"), never "always".

Head-to-head (used by the product reveal, defined here so the experiment and UI cannot disagree): compare tuples `(won, runActions, scoutActions)`: won beats lost; both won → fewer run actions; equal → fewer scout actions; equal on all → **tie**; both lost → **both failed** (reported, not a tie); AI side without a verified record → **inconclusive**.

**Discovery events** (deterministic, from the event log; no judgement): per world a small list of engine events that signify understanding. Examples: W2 `SWITCH_TOGGLED switch-teal` seen *and* `DOOR_OPENED` caused by `switch-orange` during Scout; W3 `PLATE_PRESSED` by a block; W4 `NO_EFFECT switch-triangle` then `SWITCH_TOGGLED switch-circle` then triangle toggled; W5 `EPOCH_CHANGED` during Scout, then a successful far-door opening. Reported as "discovered before the Run: yes/no". No marks for "creativity".

No artificial handicap and no leaderboard of models; cross-model tables are descriptive.

## 13. Experiment matrix and pre-registration

Before any paid run, a short `PREREG.md` (committed) fixes: models and configs, prompt hash, the table of metrics above, and the interpretation thresholds below. Thresholds are *decision aids*, not tests of significance:

| Result for a world | Interpretation | Consequence |
|---|---|---|
| k ≥ 9/10 with median waste ≤ 1 | Trivial for this model | Candidate to harden: Scout below the optimum, larger or variant worlds (`scout-run-evaluation.md`) |
| 2 ≤ k ≤ 8 | Contest band (the plan's 15–85% target, widened for N=10) | Keep; collect human data |
| k ≤ 1/10 | Too hard or ambiguous | Check forfeits and notes first: may be an observation or prompt problem, not difficulty |
| Voids or unverified > 5% | Harness problem | Fix harness; do not interpret |

## 14. Threats to validity (stated up front)
Ten runs is coarse; prompt wording matters (hence frozen and published); models may have seen similar puzzles in training; providers change models silently (hence identity and date in every record, and a re-run later is a new dataset); results are about *these* five worlds; ASCII vs pixels is an unscored difference; a model's self-reported `note` is not its reasoning.

## 15. Readiness checklist for the experiment (what "done" means before paying for runs)
- [ ] Prompt, turn template and schemas frozen with golden-snapshot tests and a no-hidden-keys test.
- [ ] Adapter contract tests pass for the scripted adapter and each real adapter.
- [ ] Runner dry run with the scripted adapter reproduces known optimal runs and a known loss; with the random adapter produces forfeits and losses and never crashes.
- [ ] Verifier passes all real records and fails a corrupted fixture.
- [ ] Price table and spend cap set; one-attempt-per-world dry run costed.
- [ ] `PREREG.md` committed.
