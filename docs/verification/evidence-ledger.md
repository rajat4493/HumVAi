# Evidence ledger — M0 corrections

Legend: **Implemented** = exists in the repo. **Verified** = a check ran and passed (command and result given). **Untested** = exists or is claimed but nothing verifies it.

## Required corrections

| # | Item | Implemented | Verified by | Untested / caveat |
|---|---|---|---|---|
| 1 | Level 3 redesign: dead states reduced | Block can be dragged (`INTERACT` on an adjacent block). Map unchanged | Solver: **0 dead, 0 irreversible of 183 states** (was 137/178 dead). Unit tests: drag semantics, no-room drag = `NO_EFFECT`, wall-pinned block recovered, block still required (exit unreachable without it), optimal unchanged at 10. e2e: push, drag, free reset in browser (desktop + touch) | Whether dragging is *discoverable* and fun is untested with humans |
| 2 | Level 5: rule change essential | Far door sealed in epoch 0, rewired by the rune; level v2 | **Proof test:** search with every epoch-1 state pruned finds no win (71 reachable states explored, not vacuous). Test: every winning line has the epoch change before `WON`. Test: the phase-0 strategy loses. Test: switch-two-first order costs 17 > 16. `npm run verify:levels` asserts it for the level | Intuitiveness of the rune untested with humans |
| 3 | Budget model | Scout & Run in the engine, UI (phase pill, blueprint look, Start run, toasts) and AI-parity display. `docs/product/budget-model.md` | 11 unit tests (phase flow, free scout reset, run-reset cost, commit, exit-found auto-commit, scout-spent auto-commit, replay with both numbers, plans that scout-with-a-mistake then win in both budgets, strictness ordering) and 2 e2e (world 2 full scout→run, world 5) | Feel of auto-commit; whether players use Scout |
| 4 | Experience validation | Prototype playable across 5 worlds (review build); screenshots (22) and recordings (2 webm) | Inspection recorded in `docs/design/experience-review.md`; 7 defects found and fixed; frames from the recording inspected | **No human players.** Swipe, haptics, audio, real-device performance untested |
| 5 | AI opponent plan | `docs/product/ai-opponent-plan.md` (fairness, observations, scoring, recorded-attempt presentation, M1/M2 split, decisions) | Observation format already exists and is snapshot-tested (`renderAscii`, `observe`); parity claim rests on UI rendering only from `PublicGameState` | Nothing about the AI is implemented, by instruction. Difficulty versus real LLMs unknown |

## Checks run (clean install)

See `docs/verification/m0-evidence.md` for the full table with the numbers from the final run.

## Not verified anywhere
Frame rate and load time on real devices; Safari/Firefox; screen-reader use; colour-blind simulation; audio; real players; AI behaviour; GitHub push (blocked by repository permissions; the source is preserved as a ZIP and a git bundle).
