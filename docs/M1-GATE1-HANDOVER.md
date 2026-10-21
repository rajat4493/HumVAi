# M1 limited implementation — status at the stop point

Authorization received: Gates 0–3. **Gate 0 passed. Gate 1 implemented and verified against mock providers. Gate 2 (real model runs) is blocked by missing credentials, a blocked network host and an unapproved spending cap. Gate 3 was deliberately not started** because it begins "after verifying that the AI runner works", and a mock run is not that verification.

## 1. Human summary
- **Safe storage (Gate 0): yes.** GitHub's branch `claude/humans-vs-ai-plan-fz5yq0` pointed at the same commit as my local copy (`86f0387`) when I checked with `git ls-remote`. The commits from this gate are pushed after the checks below.
- **AI runner (Gate 1): built.** A model-neutral player interface, an Anthropic adapter and an OpenAI adapter, a runner that plays the real engine, a verifier that replays every attempt independently, cost/latency/legal-action tracking, spend caps, and a command-line tool. 101 automated tests pass. Keys live only on the server side; the browser bundle was scanned and contains none.
- **Real model runs (Gate 2): not done, and I will not fake them.** Two things stop me: this environment has no `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, and the network blocks `api.openai.com` (Anthropic's host is reachable). I also need an OpenAI model id from you, prices, and an approved spend cap. Until then there is no real model evidence, no real cost, no real latency.
- **Rivalry experience (Gate 3): not started**, for the reason above. It needs real recorded attempts to show.

## 2. What you need to do to unblock Gate 2
1. Add the two API keys as **environment secrets/variables** in the cloud environment settings (names `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`). Do not paste keys in chat. A new session picks them up.
2. In the environment's **Network access**, allow `api.openai.com` (and keep `api.anthropic.com`).
3. Tell me the OpenAI model id you want. I will not guess one: `preflight` checks it against OpenAI's own model list. For Claude Sonnet I will use `claude-sonnet-5-5` (the identifier this environment reports), verified the same way.
4. Provide prices (US$ per million input/output tokens) for both models so costs can be measured, **or** accept a token cap instead (costs are then reported as unavailable).
5. Approve a spending cap. Sizing from the measured prompt sizes (`docs/ai/experiment-spec.md` §11): Level 1 single attempts are tiny (≤ 12 calls, ≤ ~28k input tokens each worst-case). The full pilot (3 attempts × 5 worlds × 2 models) is at most about 2.6M input tokens per model uncached, plus output (which can be much larger if the models reason). I recommend setting the cap after seeing the Level-1 measurements; the runner stops itself at the cap.

## 3. Evidence ledger

| Item | Implemented | Verified | Not verified |
|---|---|---|---|
| Gate 0 preservation | branch on GitHub | `git ls-remote` hash equals local HEAD (86f0387) | final-commit remote hash is reported in the delivery message |
| Provider-neutral interface | yes (`ModelAdapter`, `AdapterError`, request/response types) | scripted, random and text adapters run through the same runner; 101 tests | |
| Anthropic and OpenAI adapters | yes (chat and responses styles) | request shape, auth headers, usage normalisation, retries, error mapping, timeouts, full attempts over HTTP, against local mock servers | **Any real API call.** No key; OpenAI host blocked; real response shapes, model availability, rate limits unconfirmed |
| Public observations and legal actions only | yes | tests scan full conversations for all five worlds for hidden-rule keys; engine untouched | |
| Engine preserved | `game-core` unchanged since M0 | all 47 original tests still pass | |
| Logging: identity, config, actions, observations, tokens, cost, latency | yes (`records.jsonl`, `calls.jsonl`) | schema exercised end to end including cost from a price table (exact arithmetic test) | real token counts and latencies |
| Replay verification of every attempt | yes, at save time and again at report time | 8 corrupted-record tests fail as they should; 300 random-player attempts and all scripted attempts verify | |
| No keys in the browser | yes | lint rules, build-time bundle scan (4 files clean), key-sentinel tests on records/logs/CLI output | |
| Preflight against real providers | yes | ran here: both providers report "key is not set"; Anthropic host reachable (HTTP 401 without a key); OpenAI host blocked (proxy 403) | model-id existence |
| Pilot runs (Gate 2) | runner ready | — | **not run** |
| Cost, token, latency, legal-action rate from real models | reporting implemented | formulas verified on mock data | **no real measurements exist** |
| Rivalry UI, results, replay, sound (Gate 3) | not started | — | — |
| Screenshots/recordings of the rivalry experience | n/a | — | none; no new UI |

## 4. Known limitations
- Everything real-world about the adapters is unconfirmed until the first live call.
- OpenAI model quirks (reasoning-model parameters, chat vs responses API) are handled generically and may need a small fix at first contact.
- Prices are never hard-coded; without a price table costs are reported as unavailable.
- Ten-run experiments are not enabled by default; the pilot is capped by you.
- No prompt caching (cost only).
- GitHub push of the final commit is reported in the delivery message.

## 5. Engineering handover
Architecture and usage: `docs/ai/runner.md`. Code: `packages/ai-adapters`, `apps/runner`, `tools/scan-bundle.mjs`, tests in `packages/ai-adapters/test` and `apps/runner/test`. New root scripts: `npm run runner -- …`, `npm run scan:bundle` (also part of `npm run check`). Next step after Gate 2: read the pilot report, then Gate 3 against real recorded attempts using `RunRecord` as the data contract (`docs/design/rivalry-experience-spec.md`).

## 6. TheDuck learning notes
- **Verify access before promising a gate sequence.** The authorization assumed keys and network access; a one-minute environment probe (done first here) shows what is feasible and what must be requested.
- **Never substitute mocks for the evidence a gate asks for.** The runner is proven against mocks to the extent mocks can prove it; the real-model gate stays open and says so.
- **Put spend controls in code, not in discipline:** live runs need an explicit flag and a cap; the cap stops mid-attempt; caps need operator prices so nothing is guessed.
- **Let the provider name the model.** Preflight against the provider's list removes the "invented model id" failure class.
- **Test the infinite loops you can imagine.** A free scouting `RESET` loop is legal, costs nothing and never ends; only the call cap stops it, and a test now proves it.
- **Keep secrets structurally out of the browser** (lint + bundle scan), not only out of the code you remember.
- **Interpret gate order literally when evidence is missing.** Gate 3 was left unbuilt rather than demonstrated with fixtures that could be mistaken for real AI performance.
