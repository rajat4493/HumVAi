# AI runner — usage and design notes (Gate 1, implemented)

Implements `docs/ai/experiment-spec.md` with the deviations listed at the end. Server-side only.

## Packages added (only these two)
| Package | Contents | Browser-safe? |
|---|---|---|
| `packages/ai-adapters` | `ModelAdapter` interface, frozen prompt, strict reply parser, attempt runner, independent verifier, stats; `./providers` subpath = Anthropic and OpenAI adapters (plain `fetch`, no SDK dependency) | Root export yes (no Node built-ins, lint-enforced). `./providers` is never imported by the web app (lint-enforced) |
| `apps/runner` | CLI (`preflight`, `run`, `verify`, `report`), experiment executor (interleaving, resume, spend cap, void retries), JSONL store, report builder | No (Node) |

`@hva/game-core` is unchanged: the engine, solver and levels are exactly the M0 versions.

## Commands
```bash
npm run runner -- preflight --model anthropic:claude-sonnet-5-5 --model openai:<id>
npm run runner -- run --live --model anthropic:claude-sonnet-5-5 --model openai:<id> \
    --out experiments/pilot-1 --levels w01-first-steps --attempts 1 \
    --prices experiments/prices.json --spend-cap-usd 2          # or --max-total-tokens N instead of prices
npm run runner -- verify --out experiments/pilot-1
npm run runner -- report --out experiments/pilot-1 --write experiments/pilot-1/REPORT.md
```
Keys come only from `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in the runner process environment. Test/proxy overrides: `HVA_ANTHROPIC_BASE_URL`, `HVA_OPENAI_BASE_URL`.

## Safety rails (each tested)
- `run` refuses without `--live` and without a spending limit; `--spend-cap-usd` also requires an operator price table (prices are never guessed). New attempts stop at 90% of the cap; a running attempt stops at 100% and is recorded as `void: spend-cap`.
- `preflight` checks the key exists and that the exact model id is in the provider's own model list, so an identifier is never guessed. A failure exits non-zero.
- Keys exist only in the adapter's request header. Tests assert the key is absent from every record, log file, CLI output, and the production web bundle (`npm run scan:bundle`).
- The model only proposes an action. The engine validates and executes it; nothing but `observe()` + last events + `legalActions()` + the briefing reaches the model (tested over full conversations for all five worlds).
- Operational limits only (`docs/ai/experiment-spec.md` section 6): 20 rejected actions → `forfeit`; call cap `E + X + 20 + 10` → `void: call-cap` (needed: a free scouting `RESET` loop is otherwise infinite, and is tested); 300 s per call; adapter errors, context overflow, spend/token cap → `void` with a reason. Voids are kept in `records.jsonl`, never counted as losses, retried up to 3 times except for auth/cap/context errors; an auth failure aborts the whole run.

## Output layout (`--out <dir>`)
`records.jsonl` one `hva.run.1` per attempt (steps with observation hash, action, validity, events, note, per-call tokens/latency/finish reason/request id/responded model; outcome; totals incl. cost when a price exists; model identity, sampling, config hash, prompt hash, git version) · `calls.jsonl` the exact user message sent and raw reply received per step · `meta.jsonl` verification result at save time.

## Verification (`verifyRecord`)
Replays every record from scratch against the engine and fails on: a different observation hash than the engine would have shown, changed validity or events, actions after the end, wrong scout/run/rejected counts or final state hash, exceeded budgets, outcome that replay does not reproduce, token totals that do not sum. Eight corrupted-record tests prove it can fail. The runner verifies each record as it saves it and `report` re-verifies everything.

## Deviations from the spec (flagged)
1. The system prompt gained a short "action formats" example block so the JSON shape is unambiguous (hash `sha256:e5d5c969…` in the prompt test; any edit fails that test).
2. No prompt caching in v1 (changes cost, not content; an unnecessary unknown for the first real calls).
3. Anthropic `max_tokens` is required by the API; default 16,000, recorded in the sampling config. OpenAI sends no token cap, no temperature, and the model's default reasoning.
4. OpenAI: both `/v1/chat/completions` (default) and `/v1/responses` are implemented (`--openai-api responses`); which one a given model needs is not assumed.
5. Observation hash is the engine's 32-bit FNV hash (as in the spec sample record); the final state hash is the engine's.
6. Not implemented: condition B, spend tracking across separate CLI invocations beyond what is stored in `records.jsonl` (it is re-summed on resume), non-streaming only.

## What has and has not been verified
Verified (mock HTTP servers on localhost, scripted and random test players): request shapes, headers, usage normalisation, retries, error mapping, timeouts, full attempts over HTTP, caps, resume, void handling, verifier, report, CLI guards. **Not verified: any real provider API.** The adapters have never spoken to Anthropic or OpenAI because this environment has no keys and cannot reach `api.openai.com`.
