# HUMANS vs AI — Master Specification (living document)

This is the single source of truth. Update it with **verified** decisions; do not fork competing plans.

The original plan was supplied in chat. It is summarised here by *decision status* rather than re-typed, to avoid transcription drift.

| Area | Decision | Status | Evidence / link |
|---|---|---|---|
| Platform | Browser-first, desktop + mobile | Frozen | `apps/web` |
| Genre | Competitive discovery puzzle adventure | Frozen | — |
| Game 1 | "The Experiment": hidden rules in miniature worlds | Frozen | `docs/design/levels.md` |
| Engine | Pure TS, deterministic, replayable, partially observable | **Implemented (M0)** | `packages/game-core`, `docs/architecture/engine.md` |
| Budget | **Scout & Run** (explore sandbox with free reset, then strict run). Replaces the single shared budget | **Implemented; review corrections** | `docs/product/budget-model.md` |
| Levels | 5 handcrafted, solver-verified; L3 has no dead states, L5's rule change is provably essential | **Revised and verified** | `docs/verification/solvability-report.md` |
| Renderer | Phaser (pinned 3.90.0) | **Approved** | M0 review |
| Visual identity | Playful Futurism | Provisionally approved | `docs/design/design-system.md` |
| AI opponent | Real model via adapter, recorded attempts | **Plan proposed, not implemented** | `docs/product/ai-opponent-plan.md` |
| Backend / DB / auth | Fastify, Postgres, Drizzle | Not started | — |
| Campaign | 20 levels | Unvalidated target | audit §2 |

## Milestones

M0 foundation (this deliverable, awaiting approval) → M1 playable vertical slice → M2 real AI competitor → M3 campaign → M4 frontier/discovery → M5 social/beta. Gates are as in the original plan.

## Change log

- M0: foundation, engine, five levels, visual prototype of level 1. See `docs/M0-HANDOVER.md`.
- M0 review corrections: Level 3 recoverable (block drag), Level 5 rule change essential, Scout & Run budgets, experience review, AI opponent plan. See `docs/M0-CORRECTIONS.md`.
- M1 preparation gate: AI experiment spec, Scout & Run A/B evaluation, rivalry UX spec, M1 work packages. See `docs/M1-PREP-HANDOVER.md`. Nothing implemented.
- Approved in review: stay on Phaser 3.90, keep level order, keep minimal repo structure, keep visual direction provisionally.
