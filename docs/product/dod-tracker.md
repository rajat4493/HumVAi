# Definition-of-Done tracker (Master Production Prompt, Part 10)

Status vocabulary: **Met** (evidence exists and was checked), **Partly** (some of it is true), **Unmet**, **Blocked** (needs something outside the coding environment). Updated at each milestone; last update: Stage 1 (rivalry, accessibility, deployment setup).

| # | Requirement | Status | Evidence / what is missing |
|---|---|---|---|
| 1 | Working browser URL | **Blocked** | Pages workflows and `docs/DEPLOY.md` exist; nothing has been deployed or loaded on GitHub. Needs the owner to enable Pages and merge/run the workflow |
| 2 | Start without registering | **Met** | No accounts anywhere; progress is local; e2e covers a fresh start |
| 3 | Twenty quality-controlled levels playable | **Built, not yet quality-controlled by people** | 20 of 20 exist and pass the solver gates and a browser win-through on keyboard and touch. Levels 1-10 had the structured review in `docs/design/level10-review.md`. Levels 11-20 have had no review and no human has played any of the 20, so "quality-controlled" is not yet earned. |
| 4 | All levels have verified solutions | **Met** | `npm run verify:levels` (solvable, replay-verified, 0 dead states) for all 20; `tests/e2e/campaign.spec.ts` wins each one through the real controls |
| 5 | Five chapters with meaningful progression | **Partly** | Three chapters populated (Awakening, The Unknown, Adaptation) with 5 worlds; The Strategist and The Frontier do not exist yet |
| 6 | A genuine AI opponent has produced verified results | **Blocked** | Runner built and verified against mock providers only. No API keys in the environment, `api.openai.com` blocked, no approved spend cap, no OpenAI model id. No real model has been run |
| 7 | AI comparisons and replays are accurate | **Partly** | Comparison rule, selection rule, in-browser replay verification, tamper rejection and replay cadence are tested with labelled reference-player fixtures. Not demonstrated with a real model (none exists) |
| 8 | Coherent, polished visuals | **Partly** | Reviewed by inspection (screenshots); no human opinion yet |
| 9 | Animation and sound enhance gameplay | **Partly** | 23 synthesised cues and generative music implemented and unit-tested; subjective quality unheard by a human; iOS audio unlock untested |
| 10 | Desktop and mobile controls reliable | **Partly** | Keyboard and touch-emulation e2e pass in Chromium; no real devices |
| 11 | Progress saves correctly | **Met (in Chromium)** | Save/parse/resume/blocked-storage tests (unit + e2e) |
| 12 | Hints and recovery | **Met** | Three-tier hints with assisted marking; free scout reset; drag mechanic; resume after refresh |
| 13 | Daily challenges and basic achievements | **Partly** | Eight verified achievements and the local Hall are done; daily challenge not built (Stage 4) |
| 14 | Tested across major browsers | **Blocked** | Only headless Chromium is installed here (desktop and a touch-emulation profile) |
| 15 | Security and privacy requirements | **Partly** | No secrets in the browser (lint + bundle scan), no network calls to providers, local-only data, static hosting. No threat model review by a human; no backend to attack |
| 16 | Real users have tested the game | **Blocked** | No playtests have happened |
| 17 | Critical defects resolved | **Partly** | Known defects fixed as found; no external testing to find others |
| 18 | Release deployed and smoke-tested | **Blocked** | See 1 |
| 19 | GitHub contains the verified release source | **Partly** | Branch pushed and current; not merged to `main`; no tagged release |
| 20 | Engineering handover and evidence ledger complete | **Partly** | Maintained per milestone; final handover only at release |

The game is **not production-ready**. Items 1, 3, 5, 6, 14, 16 and 18 are the main gaps.
