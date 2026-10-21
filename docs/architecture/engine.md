# Architecture (M0)

```
apps/web (React shell + Phaser board)  ──imports──▶  packages/game-core (pure TS)
                                                         ▲
tests/e2e (Playwright) ──drives browser                   │ also imported by Vitest, solver, verify script
```

## Layout

```
packages/game-core/
  src/types.ts      Actions, challenge definition, hidden rules, public vs internal state, events, outcome
  src/world.ts      parse + validate a ChallengeDefinition (throws on any structural problem)
  src/engine.ts     create / step / stepInternal / observe / legalActions / evaluate / replay / hashing
  src/solver.ts     BFS over the real transition function; dead-state analysis
  src/ascii.ts      text rendering of an observation (the AI-facing format)
  src/levels/       five handcrafted ChallengeDefinitions
  test/             47 unit tests
  scripts/          verify-levels.ts → docs/verification/solvability-report.md
apps/web/src/
  game/controller.ts   owns engine state; keyboard; Phaser lifecycle; subscribe() for React
  game/GameScene.ts    renders PublicGameState; animates GameEvents; never decides rules
  game/textures.ts     procedural art
  game/theme.ts        colour/shape constants (mirror of tokens.css)
  screens/, components/, styles/   React UI
tests/e2e/             smoke + screenshot specs
```

## The engine contract (as built)

```ts
create(challenge, seed): GameState                 // internal, contains hidden rules reference
observe(state): PublicGameState                    // the ONLY thing a participant sees
legalActions(state): GameAction[]                  // MOVE×4, adjacent INTERACTs (switch toggle / block drag), RESET, COMMIT while scouting
step(state, action): StepResult                    // mutates state in place, returns {state: public, events, valid, terminal}
stepInternal(state, action): {next, result}        // pure version (solver, replay)
evaluate(state): GameOutcome                       // status, won, scoutActions, runActions, rejectedActions, finalStateHash
replay(challenge, actions, seed?): GameOutcome     // from scratch; flags actions after game end
```

Deviation from the plan's conceptual interface: `step` takes the *internal* state (the plan's signature was ambiguous); participants only ever receive `PublicGameState`.

## Requirement → mechanism

| Requirement | Mechanism | Verified by |
|---|---|---|
| Determinism | No randomness/time in core (ESLint bans `Math.random`, `Date.now`, DOM, React, Phaser imports); state hash | `engine.test.ts` determinism; lint probe |
| Partial observability | Hidden rules live only in `ChallengeDefinition.rules`; `observe()` copies none of it | tests assert no `rules/doors/shift/switchEnabled` keys |
| Fairness | Same `PublicGameState`, same budget, same `legalActions` for both actors; rejected actions counted | tests; design |
| Verification | `replay()` re-executes from scratch; `finalStateHash` | solver replay in every level test |
| Versioning | `ChallengeDefinition.version`; hash includes id+version+seed | design (no migration tooling yet) |
| Security | **Not addressed in M0** (no server). Building block: server will call `replay()` and ignore client scores | — |

## Rule model

**Budgets** are `{ explore, execute }` (Scout & Run, see `docs/product/budget-model.md`); the engine tracks `phase`, `scoutUsed`, `runUsed`, and resets the world on `COMMIT`. The solver analyses the run in isolation and also reports dead and irreversible states, and can prune the epoch change to prove a rule change is essential.

A world has *signals* (switch ON/OFF, plate pressed) and *doors*. Each door has a boolean condition over signals (`on / not / and / or`). Optional hidden rules: `switchEnabled` (jammed switches), `switchInitiallyOn`, and `shift` (a tripwire that moves the world to epoch 1 and inverts every door condition). After every action the engine *settles*: recompute plates, then doors, emitting open/close/press/release events. New mechanics = new condition/effect types, not new special cases in `step`.

## What is deliberately missing

Database, API, auth, AI adapter, model runs, event storage, consent records, verification pipeline, `challenge-schema` / `ai-adapters` / `shared` packages. Each has a place in the plan's layout and none has a consumer yet.
