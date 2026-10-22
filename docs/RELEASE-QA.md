# Release QA

Status of the build on `claude/humans-vs-ai-plan-fz5yq0`. This separates what a machine has checked from what only people, other browsers, real devices or real providers can check. **The game is not declared production-ready**; the unmet gates are listed at the end.

## Verified by automated checks (latest run: 244 unit tests, 113 browser tests, 5 skipped by design)
| Area | Evidence |
|---|---|
| Rules engine, solver, replay | 229 unit tests; every world solvable within budget, 0 dead states, replay-verified (`npm run verify:levels`, `docs/verification/solvability-report.md`) |
| All 20 worlds playable | `tests/e2e/campaign.spec.ts` wins each world through the real controls (keyboard, and touch on a 390x780 phone profile) in exactly its optimal number of run actions |
| Phone layout | no horizontal scroll and tiles of at least 36 CSS px on every world; pad buttons at least 44 px; every board at most 10 tiles wide (unit test) |
| Saves | tolerant parsing, memory fallback when storage is blocked, resume after refresh, older saves stay playable when worlds are inserted before finished ones, reset erases after confirmation |
| Accessibility (automated) | axe-core WCAG 2.1 A/AA scan: no serious or critical violations on title, map, completed map, settings, Hall, briefing, arena, hints, menu, board description, result, replay, ending and World 20; dialogs trap focus and restore it; keyboard-only play; live-region announcements; text board description |
| Motion and sound | reduced-motion setting honoured; audio gesture-gated, 25 synthesised cues, level and duration limits tested; spring-pop cue mapping tested |
| AI honesty | recorded opponents are re-verified in the browser by replay; tampered or stale recordings give INCONCLUSIVE; labels say recorded, never live; no AI result is shown before the human finishes; the ending claims no AI result unless recordings exist (tested) |
| Keys and privacy | lint rule and bundle scan keep provider keys out of the browser; the sub-path check asserts the page never contacts a provider; nothing is sent anywhere (saves are local) |
| Production build | 1.7 MB total; title screen about 77 KB gzipped JS, the board (Phaser) loads only when a world opens; `npm run verify:subpath` serves the build under `/HumVAi/` like GitHub Pages and plays World 1 with no console errors or failed requests |
| Workflows | `ci.yml` (check, browser tests, sub-path check) and `pages.yml` are valid YAML; **neither has run on GitHub** |

## Screenshots reviewed this pass
Phone (390x780) and desktop (1280x760): the world map (twenty worlds, four per row), Worlds 5, 9, 10, 16, 17, 19 and 20, the interaction ring beside a switch, and the ending screen. Findings acted on: tile size on 10-wide boards (padding tightened), orphaned row on the map, the finale layout. Not reviewed visually: every world on every device.

## Added in the v1.0 completion pass
Opt-in local telemetry (off by default, no upload, replay-verifiable export), cost estimator and pilot runbook for the first real AI attempt, a playtest protocol and analyser, a Firefox/WebKit CI job, and a per-claim `docs/VERIFICATION-LEDGER.md`. Gameplay is unchanged.

## Not verified (needs people, devices, accounts or providers)
- **Human playtesting: none.** Enjoyment, difficulty, clarity of hints and the ending are untested. Budgets are cheap to retune (version bump).
- **Browsers and devices:** only Chromium (desktop and an emulated phone). Firefox, Safari/iOS (including audio unlock), Android Chrome, real touch hardware and low-end devices are untested.
- **Screen readers:** announcements and descriptions exist but were not tested with VoiceOver, NVDA or TalkBack. Automated scans catch only part of what matters.
- **Sound quality** on real speakers and headphones.
- **Real AI competition:** no provider key, model id, price list or spend cap exists and the OpenAI host is unreachable from the build environment. The adapters have only spoken to mock servers. No recording has been made or verified, so the game shows no AI attempt. Reference-solver fixtures (labelled "Reference solver (not an AI)") are reachable only with `?fixtures=1`.
- **Deployment:** GitHub Pages is not enabled, the workflows have not run, and no live URL has been smoke-tested.
- The crash screen (`ErrorBoundary`) is not exercised by a test.

## Known limitations
- Progress lives in the browser's local storage: clearing site data or switching browsers loses it. There are no accounts, by design.
- Hall of Humanity is local only. No daily challenge, leaderboard or sharing beyond a plain-text summary.
- Chapters 1-3 may be easy for experienced puzzle players; worlds 14-15 are short.

## Release gates still unmet
1. Human playtests of the campaign (any number of people is better than none).
2. Real, independently verified AI recordings, then the rivalry comparison can be called real.
3. Pages enabled by the owner, workflows green, live URL smoke-tested (`docs/OWNER-SETUP.md`, `docs/DEPLOY.md`).
4. Firefox, Safari and a real phone pass.

## Rollback
Pages deploys from `main`; to roll back, revert the merge commit and push, or re-run the previous successful "Deploy to GitHub Pages" run.
