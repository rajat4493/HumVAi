# HUMANS vs AI — The Experiment

A browser puzzle game about working out rules nobody explained. Each of the twenty worlds has hidden rules. You **Scout** (a free sandbox: experiment, reset, learn), then **Run** (the same world, fresh, with a strict action budget). The same budgets apply to an AI opponent.

**Status:** all twenty worlds are built and verified by solver and browser tests. No person has played them yet, and **no real AI opponent exists yet**: no provider recordings have been made, so the game honestly says there is no recorded AI attempt. See `docs/RELEASE-QA.md` for exactly what is and is not verified.

```bash
npm ci
npm run check          # types, lint, unit tests, world solvability, recording verification, build, key scan
npm run test:e2e       # Playwright (desktop + phone; needs Chromium): every world is won through the real controls
npm run verify:subpath # the production build served under /HumVAi/, as GitHub Pages does
npm run live-smoke -- <url>   # smoke test of a deployed copy (desktop + phone profiles)
npm run dev --workspace @hva/web   # http://localhost:5173
```

## How it is built
- `packages/game-core`: the deterministic rules engine, the solver and the campaign table (pure TypeScript, no browser).
- `packages/ai-adapters`, `apps/runner`: the AI runner (Anthropic and OpenAI over `fetch`, server-side only), independent replay verification, recorded-opponent format. Keys never reach the browser (lint rule plus a bundle scan).
- `apps/web`: React + Phaser. Saves are local to the device. Audio is synthesised at runtime.
- `tests/e2e`: browser tests. `tools/`: level lab, fixtures, bundle scan, sub-path check.

## Controls
Arrows or WASD to move, Space to interact (Shift + an arrow interacts with the switch or block on that side), R to reset, C to start the run. On a phone: the on-screen pad, swipe, or tap a nearby switch or block.

## Docs
`docs/OWNER-SETUP.md` (GitHub Pages and API credentials) · `docs/DEPLOY.md` · `docs/RELEASE-QA.md` · `docs/design/campaign.md` (the twenty worlds) · `docs/design/level10-review.md` (quality reviews) · `docs/ai/runner.md` · `docs/product/dod-tracker.md` (definition of done) · `docs/VERIFICATION-LEDGER.md` (what is verified) · `docs/ai/PILOT.md` (first real AI attempt) · `docs/privacy/telemetry-policy-DRAFT.md` · `docs/qa/PLAYTEST-PROTOCOL.md`.
