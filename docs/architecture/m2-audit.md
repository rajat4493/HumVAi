# M2.0 audit: from one game to a small arcade

Method: read the repository at commit `7d0a8d2` (all 20 worlds, deployed to GitHub Pages at `/HumVAi/`). Numbers below were measured, not assumed.

## Baseline (recorded before any M2 change)
- 244 unit tests, 113 browser tests (5 skipped by design), `npm run check` green, `verify:subpath` green, CI green incl. Firefox/WebKit/iPhone profile.
- Production build: title/map JS ~79 KB gzipped, board (Phaser) 332 KB gzipped loaded only when a world opens, total dist 1.7 MB.
- Deployed site: built from `a6af111` (older than HEAD; owner redeploys).

## The eight questions
**1. Reusable modules.** Genuinely reusable as they are: `packages/ai-adapters/src/providers/*` (Anthropic and OpenAI transport; zero imports from `game-core`), `apps/web/src/audio/*` (cue table and engine are game-neutral except the event-to-cue mapper), `components/Modal`, `ErrorBoundary`, `icons`, `lib/motion`, the design tokens/CSS, `save/store.ts` (`SaveStore`, `pickStorage`: a safe key-value wrapper), the telemetry *consent* and storage mechanics (`telemetry/recorder.ts` apart from its `TAttempt` shape), and `tools/live-smoke.mjs`/`check-subpath.mjs` patterns.

**2. Coupled to The Experiment.** 27 files in `apps/web/src` import `@hva/game-core`: the arena, controller, Phaser scene, replay, reveal, finale, world map, hall, save types (`LevelProgress` per world), `describe`, `caption`, achievements, opponent loading. In `packages/ai-adapters` seven of eleven modules (`run`, `verify`, `prompt`, `parse`, `opponent`, `scripted`, `types`) are bound to the grid engine's observation/action model. `App.tsx` is the Experiment's screen machine, not a suite shell.

**3. Routing today.** None. `App.tsx` holds a `useState` screen (`welcome | map | settings | hall | finale | play`) and reads developer query parameters (`?screen=arena&level=...&unlock=all&fixtures=1&briefing=0`) that dozens of tests rely on. Consequence: the browser Back button leaves the site, and a refresh returns to the title (an unfinished run is restored by the session record, not by the URL).

**4. Local storage and what could break saves.** Keys: `hva.save.v1` (progress, achievements and **settings** in one record), `hva.session.v1` (run in progress), `hva.telemetry.v1`, `hva.telemetry.consent.v1`. Everything is parsed tolerantly with a memory fallback. What could break saves: renaming or re-versioning those keys, changing `LevelProgress`, or moving settings out of the save record. **Decision: change none of them.** A second game gets its own key; nothing is migrated, so nothing can be lost.

**5. Can the AI runner serve other game types without a rewrite?** Two layers. The provider layer (`ModelAdapter.decide(system, messages)`) is game-agnostic and reusable. The attempt loop (`runAttempt`, `verifyRecord`, prompt, reply parser, opponent recording) is written against the grid engine. A second game needs its own small loop and verifier that reuse the adapters; trying to generalise `runAttempt` now would be speculative. Not changed in M2.

**6. Minimum game-module contract.** Five fields: `id`, `name`, `tagline`, `status` (`available | experimental | coming-soon`), and, when playable, `load()` returning the game's React entry (lazy). Optional: `progress()` returning a short summary for the home screen. Capabilities (AI recordings, achievements, telemetry) are declared only when a game has them; none is required. Nothing about state, rules or rendering is shared: each game owns those.

**7. Several games, no new dependencies.** Hash routing (`#/`, `#/experiment/...`, `#/pattern-hunter`) with a 40-line hook instead of a router library; one registry array; lazy imports so a game's code loads only when opened. This also works under `/HumVAi/` on Pages without server rewrites, and restores Back/refresh/deep links.

**8. Risks.**
| Risk | Mitigation |
|---|---|
| Existing tests and live-smoke start at `/` and click `play` expecting the old title screen | The home screen keeps the `play` / `welcome-settings` / `welcome-hall` test ids and the same flow (`play` opens the world map). Developer query parameters keep working and open The Experiment directly |
| Saves | No key or shape changes (see 4) |
| Bundle size | Home is tiny; every game is a lazy chunk; Phaser stays in the Experiment chunk. Budget: home + shell must not grow the initial JS by more than ~5 KB gzipped |
| GitHub Pages | Hash routes need no 404 fallback; `base: './'` unchanged; the subpath check covers `/HumVAi/` and a direct hash URL |
| Scope creep into a platform | One registry, no plugin system, no package for contracts (an `apps/web/src/suite/contract.ts` file is enough until a second *package* needs it) |
| Back-button regressions inside The Experiment | Experiment screens are mirrored into the hash and covered by new e2e tests |

## Architecture challenge (what was simplified and why)
The brief suggested a possible `packages/suite-contracts`. **Not justified:** one consumer (the web app), five lines of types. A package adds a build edge and a second place to look. The contract lives next to the registry and can move out the day a second consumer exists. Likewise no `games/pattern-hunter` rules engine in `game-core`: the second game's engine lives inside its own folder precisely to prove independence, and the proof is a test that `game-core` is not imported by it.

## Decision summary
Hash router + registry + lazy game modules. The Experiment's code moves nowhere except its screen machine, which becomes `games/experiment/ExperimentGame.tsx`. Pattern Hunter is a self-contained folder with a pure engine, a screen and its own storage key. A neutral event envelope with per-game payload validators sits in `telemetry/`, local-only and consent-gated.
