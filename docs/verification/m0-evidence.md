# Verification evidence (final run after M0 corrections)

Run from a clean tree: `rm -rf node_modules apps/web/node_modules packages/*/node_modules apps/web/dist test-results`, then the commands below. Node v22.22.0, npm 10.9.4, Chromium from `/opt/pw-browsers` (Playwright 1.56.1). Date: 2026-10-21.

| Check | Command | Result |
|---|---|---|
| Clean dependency install | `npm ci` | exit 0 |
| TypeScript strict typecheck (core, core scripts, web, e2e) | `npm run typecheck` | exit 0 |
| ESLint (including engine-purity rules) | `npx eslint .` | exit 0, 0 problems |
| Unit tests | `npx vitest run` | **47 / 47 passed** |
| Solvability, all 5 levels | `npm run verify:levels` | exit 0, all PASS (table below) |
| Production build | `npm run build` | exit 0 |
| Browser tests (desktop 1280×760, mobile 390×780 touch) | `npm run test:e2e` | **14 passed, 2 skipped** (keyboard-only test on mobile, touch-target test on desktop; both intentional) |
| Screenshots | `npm run screenshots` | 22 images regenerated |
| Recordings | `npm run recordings` | 2 webm files (desktop, mobile) |
| Dependency audit, production | `npm audit --omit=dev` | 0 vulnerabilities |
| Dependency audit, all | `npm audit` | dev-tooling advisories present (vitest chain, `braces`); not shipped; not fixed |

## Build output
```
dist/index.html                     0.56 kB │ gzip:   0.34 kB
dist/assets/index-CPhGDDc-.css     11.02 kB │ gzip:   3.33 kB
dist/assets/index-DH_OTyAt.js     224.85 kB │ gzip:  71.47 kB
dist/assets/phaser-DFK5Ua9d.js  1,208.06 kB │ gzip: 332.17 kB
```
Phaser is 332 KB gzip in its own chunk; app code and CSS are about 75 KB gzip.

## Solvability and shape (generated, exhaustive search then replay)
| Level | Scout / Run budget | Optimal run | Slack | Distinct optimal | Reachable | Dead | Irreversible | Shift essential | Replay-verified | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| w01-first-steps | 0 / 12 | 8 | 4 | 1 | 10 | 0 | 0 | n/a | yes | PASS |
| w02-orange-switch | 16 / 12 | 9 | 3 | 6 | 46 | 0 | 0 | n/a | yes | PASS |
| w03-locked-garden | 24 / 14 | 10 | 4 | 1 | 183 | 0 | 0 | n/a | yes | PASS |
| w04-only-when | 14 / 11 | 9 | 2 | 1 | 74 | 0 | 0 | n/a | yes | PASS |
| w05-garden-shifts | 20 / 16 | 13 | 3 | 6 | 71 | 0 | 37 | yes | yes | PASS |

Full report: `docs/verification/solvability-report.md`. "Dead" = no win reachable; "Irreversible" = can never return to the start without RESET; "Shift essential" = no winning sequence exists once the rule change is pruned.

## What the tests cover
- **Engine basics:** determinism and hashes, initialization, invalid-challenge rejection, partial observability (no hidden keys in observations; ASCII snapshot), movement and run budget, rejected actions, legal actions.
- **Scout & Run:** phase flow, free scout reset vs costed run reset, COMMIT semantics, auto-commit on exit found and on scout spent, COMMIT rejected in the run, replay reporting both numbers, scout-with-a-mistake-then-win plans for worlds 2–5, strictness ordering of budgets.
- **World 2:** real vs decoy switch, six optimal solutions, door blocks movement.
- **World 3 (revised):** plate/door timing, block on plate, drag semantics and events, no-room drag, wall-pinned block recovered, **0 dead and 0 irreversible states**, block still required.
- **World 4:** jammed switch (no explanation), square overrides triangle.
- **World 5 (rebuilt):** rune flips epoch and rewires the far door, switch-two is a dud before the rune, **proof that no sequence ignoring the rule change can win**, every win passes through the change, phase-0 strategy loses, early-toggle order costs 17 > 16.
- **All levels:** solvable within budget, optimal replays to the same length, zero dead states.
- **Browser:** world 1 by keyboard and by touch pad in exactly 8 actions; world 2 full Scout → Start run → win (world reset checked, scout tally kept); world 3 push, drag, free reset; world 5 rule change; held key = 1 action; no horizontal scroll on worlds 1, 3, 5; touch targets ≥ 44 px; no console errors on the main flows.

## Not verified / not measured
- Frame rate, load time, battery on real devices (software GL only).
- Any human's comprehension, enjoyment or difficulty (no playtests).
- Swipe gesture, haptics, audio (not built), landscape phone, Safari, Firefox.
- Screen-reader experience and colour-blind simulation.
- AI behaviour of any kind (not implemented, by instruction).
- GitHub push (blocked: repository permissions).
