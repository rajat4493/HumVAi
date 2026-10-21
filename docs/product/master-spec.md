# HUMANS vs AI — Master Specification (living document)

This is the single source of truth. Update it with **verified** decisions; do not fork competing plans.

The original plan was supplied in chat. It is summarised here by *decision status* rather than re-typed, to avoid transcription drift.

| Area | Decision | Status | Evidence / link |
|---|---|---|---|
| Platform | Browser-first, desktop + mobile | Frozen | `apps/web` |
| Genre | Competitive discovery puzzle adventure | Frozen | — |
| Game 1 | "The Experiment": hidden rules in miniature worlds | Frozen | `docs/design/levels.md` |
| Engine | Pure TS, deterministic, replayable, partially observable | **Implemented (M0)** | `packages/game-core`, `docs/architecture/engine.md` |
| Budget | One shared action budget; RESET costs 1 | **M0 choice — needs approval** | `docs/product/m0-audit.md` §3 |
| Levels | 5 handcrafted, all solver-verified | **Designed + verified (M0)** | `docs/verification/solvability-report.md` |
| Renderer | Phaser (pinned 3.90.0) | **M0 choice — needs approval** | audit §3.1 |
| Visual identity | Playful Futurism | Prototype built | `docs/design/design-system.md` |
| AI opponent | Real model via adapter, recorded attempts | Not started (M2) | — |
| Backend / DB / auth | Fastify, Postgres, Drizzle | Not started | — |
| Campaign | 20 levels | Unvalidated target | audit §2 |

## Milestones

M0 foundation (this deliverable, awaiting approval) → M1 playable vertical slice → M2 real AI competitor → M3 campaign → M4 frontier/discovery → M5 social/beta. Gates are as in the original plan.

## Change log

- M0: foundation, engine, five levels, visual prototype of level 1. See `docs/M0-HANDOVER.md`.
