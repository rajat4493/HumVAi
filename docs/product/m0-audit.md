# M0 Audit of the Product Specification (Step 1)

Source: "HUMANS vs AI — Master Product & Engineering Plan" (supplied in chat) and the M0 execution instructions.
Nothing below has been silently resolved: every ambiguity I had to settle to build M0 is marked **[M0 choice]** and repeated in the handover's "Decisions requiring human approval".

## 1. Confirmed product decisions (stated as frozen, built as written)

| Decision | Status in M0 |
|---|---|
| Browser-first, no install, no mandatory account | Built (no accounts, nothing persisted) |
| 2D miniature-world puzzle, Playful Futurism | Built (level 1 prototype + renderer for all 5) |
| TypeScript, React + Vite, Phaser, Vitest, Playwright | Built. **Phaser pinned to 3.x** (see §3) |
| Pure TS `game-core`, independent of React/Phaser/DB/AI | Built and lint-enforced (`no-restricted-imports`, no `Math.random`/`Date.now`) |
| Deterministic rules, objective scoring, replay verification | Built and tested |
| Five-level vertical slice is the M1 target | Five levels designed and solver-verified in M0; only L1 is player-facing |
| Fun → reliability → replayability → discovery data | Used as the tie-breaker for every choice below |

## 2. Proposed decisions that still need validation

| Proposal | Why it is not yet evidence-based |
|---|---|
| "20 levels" campaign | No data on how many distinct mechanics we can make feel fresh |
| Real LLM as an equal opponent | We have not tested whether an LLM finds these worlds trivial or impossible (see risk G1) |
| Recorded AI attempt shown after the human finishes | Fine for latency, but changes the drama; needs playtests |
| Scoring: win / efficiency / discovery / comparison | "Discovery" has no measurable definition yet (the plan itself warns about this) |
| Performance targets (60 FPS, <3 s first interaction) | Unmeasured on real devices; Phaser chunk is 1.2 MB (332 KB gzip) |
| Fastify / Postgres / Drizzle / hosted API | Explicitly out of M0; nothing validates the schema yet |

## 3. Contradictions and missing requirements

1. **Phaser version.** The plan says "Phaser 3"; the npm `latest` tag is now Phaser 4.x. **[M0 choice]** pinned `phaser@3.90.0` to follow the plan. Needs a human decision before M1 (3.x is mature; 4.x is current).
2. **The example round contradicts the mechanics table.** The example world ("The Locked Garden": switch + movable purple block, 10 moves) uses switches *and* blocks, but the table introduces switches at Level 2 and blocks at Level 3. **[M0 choice]** Level 1 is movement only; the Locked Garden is Level 3 and is built to the plan's "10 moves" (its optimal solution is exactly 10 actions).
3. **Exploration vs execution budgets.** The plan requires explicit budgets and warns the AI must not get hidden simulations, but the engine contract has no "commit" concept. **[M0 choice]** one shared *action* budget (MOVE + INTERACT + RESET) for human and AI. A separate "free probe" phase is **not** designed; if wanted it is an M1/M2 design task.
4. **RESET semantics unspecified.** **[M0 choice]** RESET restores the world but not the budget and costs one action. Rationale: otherwise a free reset is an unlimited-experiment loophole.
5. **Invalid vs wasted actions unspecified.** **[M0 choice]** Bumping into a wall/closed door/stuck block is a *valid* action that spends budget (it is an experiment). Malformed or impossible actions (INTERACT with a non-adjacent/unknown target, anything after the game ends) are *rejected* (`valid: false`) and cost nothing but are counted. An AI runner must cap rejections (not implemented in M0).
6. **INTERACT range unspecified.** **[M0 choice]** only switches are interactable and only from an orthogonally adjacent tile.
7. **Seed has no gameplay meaning yet.** Levels are handcrafted, so `seed` is stored and hashed but changes nothing. "Hidden evaluation variations" (anti-cheat, §10 of the plan) need *parameterised* levels (e.g. permuted switch→door wiring); not designed in M0.
8. **Ties / inconclusive comparisons** are required by the plan but need an AI result to compare against. The engine outcome exposes `actionsUsed` and `won`; the comparison function is an M2 deliverable.
9. **Information parity for the AI.** Humans see animations and symbols; the AI gets a structured observation. Parity is only credible if both derive from the same `PublicGameState` — they do — but the visible cues (e.g. the world "epoch" flash in L5) must always be mirrored in that state. **[M0 choice]** `epoch` is public.
10. **Entity IDs are visible to the AI.** IDs such as `switch-orange` are part of the observation. They must never encode a rule (e.g. `door-opened-by-teal`). Enforced only by review today; worth a validator in M1.
11. **Repository layout.** The plan lists `challenge-schema`, `ai-adapters`, `shared`, `apps/api` and `content/`. **[M0 choice]** none created: schema types live in `game-core` (no consumer outside it yet), levels live in `game-core/src/levels` so the package is self-contained and testable. `content/` and `docs/*` exist as folders.
12. **Mechanics deferred by the plan itself:** memory, planning, limited information. Not designed.

## 4. Technical risks

| ID | Risk | Mitigation / status |
|---|---|---|
| T1 | Phaser bundle size vs the 3 s first-interaction target | Split into its own chunk; welcome screen is plain React and loads before Phaser runs. Not measured on real networks. |
| T2 | Phaser's own keyboard plugin double-dispatched fast key presses in headless Chromium (found and fixed in M0: an 8-move run logged 11 actions) | Keyboard input moved to a native `keydown` listener in the controller with `event.repeat` ignored; covered by an e2e test |
| T3 | Rendering/perf on low-end phones unmeasured | Textures are generated once; scene is ~100 static sprites. Needs real-device test in M1 |
| T4 | Headless screenshots use SwiftShader (software GL) | Representative of layout, not of GPU performance |
| T5 | Dependency drift (Phaser 4, TypeScript 7, Vite 8 all exist) | Exact versions pinned; lockfile committed |
| T6 | State-space blow-up for the exhaustive solver on larger levels | Fine for M0 (≤178 states). Will need pruning/A* for 20 levels |

## 5. Game-design risks

| ID | Risk |
|---|---|
| G1 | **These worlds may be trivial for an LLM** (tiny grids, ≤178 reachable states). A contest that the AI always wins in 10 actions has no tension; one it never wins is a puzzle with an AI label. Needs measurement in M2 before any content is scaled. |
| G2 | Levels 2–5 may feel like one puzzle in four skins ("find the switch"). Distinctness is argued in `docs/design/levels.md` but untested with players. |
| G3 | L3 has 137 dead states out of 178 reachable (block pushed into a corner). RESET recovers, but budget slack (6) only absorbs a mistake made early. Could feel punishing or satisfyingly tense; test. |
| G4 | L5 can be completed *without understanding the rule change* (never touch switch-two). The adaptation moment only happens to players who apply the L2 lesson. Intended, but the "aha" is optional. |
| G5 | L1 has no hidden rule; some players will find it dull. It is deliberately a 20-second onboarding. |
| G6 | "Human vs AI" reveal is a placeholder; the soul of the product is not yet testable. |

## 6. Deferred (not built, by instruction or by judgement)

Real/recorded AI attempts; any API/DB/auth/payments; multiplayer; leaderboards; 20-level campaign; analytics; sound implementation (only specified); world map and settings screens (specified, not built); save/progress; hints; accounts; anti-cheat server (engine replay is the building block).
