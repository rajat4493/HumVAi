# M2 handover: from one game to a small arcade

Branch `claude/humans-vs-ai-plan-fz5yq0`. Starting point `7d0a8d2` (The Experiment, 20 worlds, deployed at `/HumVAi/` from `a6af111`). Audit: `docs/architecture/m2-audit.md`.

## Human Summary
**What changed.** The site now opens on an arcade home screen ("HUMANS vs AI. Different games. Different intelligences. One question: can you beat AI?") with a prominent **Play The Experiment** button, saved progress, and a catalogue of three games: The Experiment (Available), Pattern Hunter (Experimental prototype) and The Detective (Coming soon, no play button). Pattern Hunter is a small, separate, playable puzzle that proves a second game can be added without touching The Experiment.
**What players can now do.** Tap one button to resume or start the campaign; open the Pattern Hunter prototype (test numbers, predict six more, get checked feedback, retry, see their record); use the browser's Back button, refresh and shareable links inside the app.
**What did not change.** All 20 worlds, Scout then Run, controls, touch, audio, settings, achievements, AI-recording verification, saves (no key or shape changed; a test asserts the save is byte-for-byte untouched), the `/HumVAi/` address, the rules engine, the AI runner and adapters (zero lines changed in `packages/` and `apps/runner`).
**What is still missing.** A real AI opponent (still none; the home screen says so), human playtests, a real second game, and any server. Pattern Hunter has one puzzle and no AI.

## Requirements: status
| Requirement | Status |
|---|---|
| Existing Experiment campaign remains playable (all 20 worlds, keyboard and touch) | **Verified** (`campaign.spec.ts`, Chromium; CI also Firefox/WebKit/iPhone profile, pending re-run) |
| Existing saves intact | **Verified** (unit + `suite.spec.ts` byte comparison; no storage key or shape changed) |
| All existing automated tests pass | **Verified** locally: 280 unit, browser suite green (see below). Four existing tests needed edits for the new URL behaviour; see "Migration behaviour" |
| Landing page on desktop and mobile | **Verified** (Chromium desktop and phone emulation, screenshots reviewed); **real devices not tested** |
| Catalogue navigation | **Verified** (e2e) |
| Pattern Hunter independently playable | **Verified** (e2e, a11y scan, engine unit tests) |
| Registering a game needs no change to Experiment mechanics | **Verified**: zero diff in `packages/game-core`; test that Pattern Hunter imports nothing from the grid engine, campaign, save or Experiment screens |
| Production build works under `/HumVAi/` | **Verified** (`verify:subpath`, now incl. direct hash links) |
| No API keys or sensitive data in bundles | **Verified** (bundle scan, 7 files clean; live-smoke key-pattern scan) |
| No unapproved network telemetry | **Verified** (no upload code; tests assert one origin and no event writes without consent) |
| Versioned neutral event envelope, per-game schemas, local-only demo | **Verified** (17 unit tests + e2e); no pipeline, by design |
| Browser Back, refresh, direct links, resume | **Verified** (e2e) |
| Firefox / Safari engines on the new screens | **Implemented but unverified**: `suite.spec` added to the CI cross-browser job; first run pending |
| Real-device testing | **Blocked** (no devices) |
| Deployment of this build | **Not done** (owner-run; gate below) |
| Pattern Hunter campaign, AI for it, Detective, other games, accounts, leaderboards, payments | **Not implemented** (out of scope) |

## Engineering handover
**Architecture (decisions).**
- *Hash routing, 40 lines, no dependency* (`suite/router.ts`). Chosen over a router library: works on Pages without rewrites, gives Back/refresh/deep links. Routes: `#/` home, `#/settings`, `#/experiment/{map|play/<world>|settings|hall|finale}`, `#/pattern-hunter`. Unknown or coming-soon addresses land on home.
- *One registry, lazy games* (`suite/registry.ts`, `suite/contract.ts`). The contract is five fields plus an optional `load`, `progress`, `capabilities`. No package: one consumer. Initial JS is smaller than before: 255 KB raw / 80.7 KB gzipped now, against 271 KB raw at the start of M2 (the Experiment's map, hall and finale moved into their own lazy chunk, 4.6 KB gzipped); Phaser still loads only when a world opens.
- *The Experiment moved one file*: `App.tsx` became `games/experiment/ExperimentGame.tsx`, now driven by the URL instead of local state. Screens, engine, save, audio, controller stayed where they were.
- *Pattern Hunter is a self-contained folder* (`games/pattern-hunter/`): pure engine (`engine.ts`: probes, predictions, deterministic `verifyLog`), screen, own storage key `hva.ph.v1`, event emitter. Its result is re-derived from the player's log before it is stored.
- *Data foundation* (`telemetry/envelope.ts`, `eventlog.ts`, `schemas.ts`): envelope `hva.event.1`, per-game field-table validators that reject free text, consent-gated local log `hva.events.v1`, neutral export `hva.events.1` (Experiment attempts converted on the fly; the Experiment's own replay-verifiable record is unchanged). Consent wording bumped to `draft-2`; consent under older wording is not honoured.
**Files.** New: `apps/web/src/suite/*`, `games/pattern-hunter/*`, `telemetry/{envelope,eventlog,schemas}.ts` (+tests), `opponent/{count,base}.ts`, `tests/e2e/suite.spec.ts`, `docs/architecture/m2-audit.md`, `docs/privacy/event-schema.md`, `docs/product/validation-gate.md`. Changed: `App.tsx` (now the shell), `Settings.tsx` (neutral export, wording), `telemetry/{recorder,instance,types}.ts`, `opponent/load.ts`, `Finale.tsx` (import), styles, tools (`live-smoke`, `check-subpath`), a11y/progress/rivalry specs, CI cross-browser pattern.
**Migration behaviour.** None for data. For URLs: the first screen is now the arcade home instead of the Experiment's title; `Play The Experiment` leads straight to the world map (`#/experiment/map`). Old developer links (`/?screen=arena&level=...`) still open The Experiment directly. A refresh now stays on the current screen (it used to return to the title); two existing tests asserted the old landing and were updated to the new contract (`progress.spec`: reload keeps the map / the world), one `rivalry.spec` assertion had a latent race with the asynchronous recording load and now waits for it.
**Tests and results.** `npm run check`: 280 unit tests pass (was 244), 20/20 worlds verified, 20/20 fixture recordings verified, bundle scan clean. Browser suite (Chromium desktop + phone emulation): 132 passed, 6 skipped by design, 0 failed (was 113 + 5 skipped; the new tests are `suite.spec.ts`, a Pattern Hunter accessibility scan, and the cross-browser subset). Ledger rows M2-* record each claim. `verify:subpath` and a local `live-smoke` (82 checks, desktop + two phone profiles) pass.
**Deployment instructions.** Unchanged: owner runs "Deploy to GitHub Pages" on the chosen commit. **Regression gate before publishing** (the brief forbids replacing a working production site without it): (1) CI green on the commit incl. `cross-browser`; (2) `npm run live-smoke -- <staging or preview URL>` clean; (3) owner plays a world on the preview. Pages has no staging URL of its own; the lowest-risk route is to deploy from this branch only after (1) and (2) pass locally and in CI, and to keep the previous deployment run available for rollback (re-run it).
**Known limitations.** No real AI. Pattern Hunter has one challenge, deterministic and replayable (so a returning player can memorise it), no AI, no sharing. Home screen is not tested on real devices. Pages deploy of this build has not happened. The Experiment's Settings screen still carries Experiment-specific "How to play" text and is reached from the arcade as the arcade's settings (acceptable now; a second shipped game would need its own help).
**Commit and branch.** Recorded in the ledger and the final message.

## TheDuck learning
**Assumptions that were wrong.**
1. *"The suite needs a contracts package and a bigger shared platform."* One file of types and one array were enough; every extra layer (package, plugin hooks, shared services) would have been speculation.
2. *"The first screen can simply replace the Welcome screen."* It also changed what a refresh means and what several tests asserted. The URL becoming the screen is the real architectural change; it deserved its own tests, not just a new component.
3. *"Existing tests are a fixed contract."* Four encoded old behaviour (landing on a title after refresh) rather than product requirements; changing them was right, but each change had to be argued, not silent. One was a latent race that only more load exposed.
4. *"Lazy loading is free."* It silently broke the live-smoke script (the map is now a chunk that loads after the click) and shifted what "initial bundle" means; tools that read the DOM immediately needed waits.
**Abstractions that proved unnecessary.** A `suite-contracts` package, a shared progress service, extracting settings, a generalised AI runner, and a "game state" abstraction. Each game owning its state turned out to be the whole contract.
**What to recommend for future suites.** (a) Make the URL the state before adding a second game. (b) Prove independence with a test that fails on an import, not with a diagram. (c) Give each game its own storage key so saves can never collide. (d) Put the privacy rule in code (validators that reject free text) rather than in a policy that people must remember. (e) Ship a proof game that is deliberately tiny and labelled experimental, and decide the third game from evidence (`docs/product/validation-gate.md`), not from the catalogue. (f) Before a platform milestone, finish the unfinished product gates (real AI recording, playtests); the suite does not make those easier.
