# M0 Handover — HUMANS vs AI

Branch: `claude/humans-vs-ai-plan-fz5yq0`. M0 is complete and stopped here; **M1 has not been started**.

## 1. Human summary (plain English)

We now have a real foundation instead of a plan. There is a small, strict game engine that knows the rules of five hand-made puzzle worlds, and a computer search has proven that every one of them can be won within its action limit. Level 1 can be played in a browser (keyboard on desktop, on-screen pad on phones): you walk a glowing blob to an exit, it costs one action per step, and you win or run out.

The look is a dark, glowing "miniature world" style. The AI is a placeholder card — it does not play yet. That is the main thing you cannot judge from this build: whether human-versus-AI actually feels like a contest.

Things worth your attention:
- **Level 1 is deliberately simple** (an onboarding). The interesting tests of "is this fun" start at Levels 2–5, which are designed, verified and *renderable* (via a developer URL) but not yet part of the player flow.
- **Level 3 punishes mistakes** (push the block into a corner and you must spend a reset). That might be tense or annoying; only players can tell us.
- **The biggest open risk:** these worlds are small. An LLM may solve them instantly, which would make the contest dull. We need to measure that in M2 before building more content.

## 2. Files created and architecture

See `docs/architecture/engine.md` for the diagram and requirement→mechanism table. Summary:

| Path | What |
|---|---|
| `packages/game-core` | Pure TS engine, solver, ASCII observation, 5 levels, 30 unit tests, verification script |
| `apps/web` | React shell (Welcome, Briefing, Arena, Result) + Phaser board (procedural art) |
| `tests/e2e` | Playwright smoke and screenshot specs |
| `docs/product` | `m0-audit.md` (Step 1), `master-spec.md` (living spec) |
| `docs/design` | `levels.md` (Step 3), `design-system.md` (Step 4), `screenshots/` |
| `docs/architecture` | `engine.md` |
| `docs/verification` | `m0-evidence.md`, generated `solvability-report.md` |
| root | `package.json` (npm workspaces), `tsconfig.base.json` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `README.md` |

Exact pinned versions: React 19.2.9, Vite 7.3.7, **Phaser 3.90.0**, TypeScript 5.9.3, Vitest 3.2.7, Playwright 1.56.1, ESLint 9.39.5.

## 3. Screenshots

`docs/design/screenshots/`
- `desktop-01-welcome.png`, `desktop-02-briefing.png`, `desktop-03-arena.png` — level 1 flow, desktop
- `mobile-01-welcome.png`, `mobile-02-briefing.png`, `mobile-03-arena.png` — same on a 390×780 touch viewport
- `levels-01.png` … `levels-05.png` — all five levels' board rendering (developer URL), desktop

Headless software-GL captures: they show layout and art, not real-device performance. Static images do not show the animation (step squash, door/switch pulses, confetti, shift flash).

## 4. Test results

`docs/verification/m0-evidence.md`. Headline: clean `npm ci`; typecheck, lint, build all exit 0; **32/32 unit tests**; **5/5 levels PASS** solvability and replay; **8 e2e passed, 2 intentionally skipped**.

Defects found and fixed during M0 (so you can trust the process, not just the result):
1. Phaser's keyboard plugin double-dispatched fast key presses (an 8-move run logged 11 actions) → replaced with a native listener, regression-tested.
2. Wall/floor contrast was 1.67:1 → raised to 3.7:1.
3. Two of my own first-draft test assertions were wrong (mis-specified adjacency, an over-broad substring check); fixed against the real behaviour, not the other way around.

## 5. Known limitations

- Only Level 1 is in the player flow; Next world is a disabled button. No world map, settings, saves, hints, sound.
- No AI of any kind; the AI card is a placeholder.
- Accessibility is partial (see `design-system.md` §8): no screen-reader board description, no focus trap in dialogs, no audio/captions, no colour-blind verification.
- Seed has no gameplay effect (levels are handcrafted); hidden-variation anti-cheat is not designed.
- One shared action budget; no separate exploration/commit phases.
- No ties/inconclusive logic yet (needs an AI result to compare with).
- Solver is exhaustive BFS; fine for ≤178 states, will need pruning for larger worlds.
- Performance targets (60 FPS, <3 s) unmeasured; Phaser chunk is 1.2 MB (332 KB gzip).
- `npm audit` reports advisories in dev tooling (vitest/`braces` chain); production dependencies: 0.
- Chromium only; no Safari/Firefox testing.
- Art is procedural and good enough to judge direction, not final.

## 6. Decisions requiring human approval

1. **Phaser 3.90 vs Phaser 4** (plan says 3; npm latest is 4.x). Recommended: stay on 3 for M1, revisit after the visual prototype is judged.
2. **One shared action budget; RESET costs 1 and does not restore budget.** Alternative: separate exploration/commit budgets (a bigger design change).
3. **Rejected vs wasted actions:** bumps spend budget; malformed actions are free but counted (AI runner will need a rejection cap).
4. **Level order:** Locked Garden (switch+block from the plan's example) is Level 3, not Level 1.
5. **Level 5's optional adaptation** (a player can skip the rule-change lesson). Accept or redesign so the shift must be understood?
6. **Level 3 dead-state density** (137/178): keep, soften (more budget/undo), or redesign?
7. **Visual direction:** human = amber/round, AI = periwinkle/diamond, dark midnight world, procedural art. Approve, or request a different direction before M1 invests more in it.
8. **Repo layout deviation:** no `challenge-schema` / `ai-adapters` / `shared` packages yet; levels live in `game-core`.
9. **Whether to make Levels 2–5 reachable in the UI as part of M1** (they are engine-ready).

## 7. Proposed M1 plan (not started)

Goal: five excellent, playable levels on desktop and mobile. Gate (from the plan): all five playable on desktop and mobile, tests pass, real users understand the controls.

1. **Resolve §6 decisions** (1 day of review, no code).
2. **Level flow:** world map (5 nodes, local progress in `localStorage` with try/catch fallback), Briefing → Arena → Result → Next, per-level best score; Settings (sound, reduced motion override, privacy stub).
3. **Result reveal v0:** player's action log replayed as a short ghost animation; the AI slot shows an honest "recorded AI attempt — coming soon" until M2. Include tie/inconclusive layout.
4. **Polish:** audio per the spec (Web Audio, mute, gesture-gated), shift/jam feedback tuning, focus trap and board text description for screen readers, undo-free but clearer dead-state feedback in L3 (e.g. subtle "stuck" hint after a reset-worthy mistake).
5. **Content validation:** a level linter (ids never encode rules, every door has a rule, a unique optimal solution report), CI workflow running `npm run check` + e2e.
6. **Performance + devices:** measure load/FPS on 2 real phones and 1 low-end laptop; budget the Phaser chunk (lazy-load after Welcome).
7. **Playtest pass:** 5–8 non-technical players, observed, no coaching; measure completion, resets, time-to-first-action, where they stall. Decide whether to proceed to M2 or fix the levels.
8. **M1 evidence package** in the same format as this handover.

Out of scope for M1 (unchanged): AI integration, accounts, backend, multiplayer, leaderboards, payments, analytics.

## 8. TheDuck project-learning notes

- **Specification gaps surfaced by implementation, not by review.** Seven of the audit's twelve ambiguities (RESET cost, rejected actions, INTERACT range, seed meaning, budget model, epoch visibility, ID leakage) only became visible when a function had to be written. Future specs should include a "state machine edge cases" section and an "observation parity" checklist.
- **Contradictions hide in examples.** The plan's example level contradicted its own mechanics table. Add a rule: every worked example must be traced against the mechanics/intro-order table.
- **"Solvable" must be proven by the real engine.** A separate solver model would have proven nothing. The solver reuses `stepInternal`; the replay check closes the loop. Keep this pattern for all 20 levels.
- **Dead states are a design metric.** The solvability proof was green while Level 3 had 77% dead states. Add dead-state ratio to every level's acceptance report.
- **Enforce architecture in lint, not prose.** "game-core must be independent" and "no randomness" became ESLint errors (and a probe confirmed the rule fires).
- **Third-party input layers need adversarial tests.** The framework keyboard plugin looked fine until a fast-press e2e test counted actions. Always assert *action counts*, not just final outcomes.
- **Check contrast numerically in the first visual pass.** The first palette failed 3:1 for walls; a 10-line script caught it.
- **Version drift is real.** Phaser 4, TypeScript 7, Vite 8 all exist beyond the plan's assumptions; pin exactly and record the choice as a decision.
- **Keep "done" claims narrow.** M0 is proven for rules and layout; it proves nothing about fun. The evidence file lists what is *not* verified so approval is informed.
