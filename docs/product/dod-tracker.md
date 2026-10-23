# Definition-of-Done tracker (Master Production Prompt, Part 10)

Status vocabulary: **Met** (evidence exists and was checked), **Partly** (some of it is true), **Unmet**, **Blocked** (needs something outside the coding environment). Updated at each milestone; last update: v1.0 completion pass; the per-claim record is `docs/VERIFICATION-LEDGER.md`.

| # | Requirement | Status | Evidence / what is missing |
|---|---|---|---|
| 1 | Working browser URL | **Met (owner-confirmed)** | GitHub Pages build of `a6af111` deployed and played by the owner. Latest fixes are not deployed yet |
| 2 | Start without registering | **Met** | No accounts; local progress |
| 3 | Twenty quality-controlled levels playable | **Built, not quality-controlled by people** | 20 of 20 pass solver gates and a browser win-through; no human playtest |
| 4 | All levels have verified solutions | **Met** | `npm run verify:levels`; `campaign.spec.ts` |
| 5 | Five chapters with meaningful progression | **Met (structure)** | 5 chapters of 4; progression quality untested by people |
| 6 | A genuine AI opponent has produced verified results | **Blocked** | Needs the owner's key, model id, prices and cap. Runner, estimate tool and runbook ready (`docs/ai/PILOT.md`) |
| 7 | AI comparisons and replays are accurate | **Partly** | Verified with labelled reference fixtures; not with a real model |
| 8 | Coherent, polished visuals | **Partly** | Screenshots reviewed; owner said it works great; no wider opinion |
| 9 | Animation and sound enhance gameplay | **Partly** | Implemented and unit-tested; subjective quality and iOS audio unverified |
| 10 | Desktop and mobile controls reliable | **Partly** | Chromium desktop + phone emulation; WebKit/Firefox run in CI; no real devices |
| 11 | Progress saves correctly | **Met (Chromium)** | unit + e2e |
| 12 | Hints and recovery | **Met** | Three tiers, assisted marking, free Scout reset; Space/Hints bug fixed |
| 13 | Daily challenges and basic achievements | **Partly, by decision** | Achievements and local Hall done; daily challenge frozen by the owner |
| 14 | Tested across major browsers | **Met on CI engines** | Firefox, WebKit and an iPhone 13 profile pass the gameplay test subset on GitHub (run 39866878465); real devices not tested |
| 15 | Security and privacy requirements | **Partly** | No secrets in the bundle, no provider traffic, local-only data; opt-in local telemetry built; data policy draft awaiting approval |
| 16 | Real users have tested the game | **Blocked** | Protocol and analyser ready; needs people |
| 17 | Critical defects resolved | **Partly** | One owner-reported bug fixed; no systematic external testing yet |
| 18 | Release deployed and smoke-tested | **Partly** | Deployed (owner); live smoke test script verified locally, not yet run against the live URL |
| 19 | GitHub contains the verified release source | **Partly** | Branch current and CI green; not merged to `main`; no tag |
| 20 | Engineering handover and evidence ledger complete | **Partly** | Ledger exists and is maintained; final handover at release |

The game is **not declared production-ready**. Remaining v1.0 blockers: a verified real-AI recording (6), human playtests (3, 16), real-browser/device coverage (10, 14), and redeploy plus live smoke (18).

**M2 note:** the arcade shell and a second-game prototype were added without changing any of the above gates. They do not make the unmet gates (real AI recording, human playtests, real devices) easier; see `docs/M2-HANDOVER.md`.
