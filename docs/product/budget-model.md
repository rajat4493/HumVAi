# Action budget model: Scout & Run (implemented in the engine)

## Problem with the M0 model
One shared action budget made *experimenting* and *performing* compete for the same resource: every exploratory step was a step you could not spend solving. That punishes the behaviour the game exists to reward, and it makes "strict competition" and "gentle early levels" the same dial.

## The model
Every world has two numbers, **Scout** (`explore`) and **Run** (`execute`). Human and AI get identical values.

| | Scout | Run |
|---|---|---|
| Purpose | Learn how the world behaves | Perform, scored |
| World | A sandbox. Nothing here can win or lose | The real attempt on a fresh world |
| Budget | `explore` actions (0 = no scouting) | `execute` actions |
| `RESET` | **Free** | Costs 1 action |
| Ends when | player sends `COMMIT` (Start run), **or** the player reaches the exit ("you found it, now do it for real"), **or** the scout budget is spent | exit reached (win) or run budget spent (loss) |
| On ending | World resets to its start; scouting tally is kept; run counters start at 0 | — |

What carries over from Scout to Run is **only what the participant remembers**. The world itself is reset, including doors, switches, blocks and any rule change. This is also what makes the AI comparison clean: the AI carries its scouting transcript; the human carries their memory.

Scoring uses two numbers: `runActions` (the competitive one) and `scoutActions` (reported separately as discovery efficiency). Winning requires the run.

## Why this is the simple version
One extra action (`COMMIT`), one extra counter, one rule (reset is free while scouting). No per-action costs, no lives, no timers, no hint currency, no scouting score.

## The dial (how strict each level is)

| Tier | Scout `E` | Run `X` | Intent |
|---|---|---|---|
| Onboarding (nothing hidden) | 0 | 1.5 × optimal | Just play |
| Early (L2–L3) | ≥ 1.5 × optimal | ≈ 1.3–1.4 × optimal | Experiment freely; one mistake in the run is survivable |
| Mid (L4–L5) | ≈ 1.5 × optimal | ≈ 1.2 × optimal | Run requires having understood |
| Advanced / Frontier (M4) | **< optimal** (e.g. 0.5–0.8 ×) | 1.0–1.1 × optimal | You cannot rehearse the whole route; you can only test hypotheses. Strict competition |

Key rule for advanced worlds: **if `E ≥ optimal`, a participant can solve the world inside Scout and replay it**, so the run only measures execution. Advanced worlds must keep `E` below the optimal length.

Current values (all asserted by tests):

| World | Optimal | Scout `E` | Run `X` | `X`/optimal |
|---|---|---|---|---|
| 1 First Steps | 8 | 0 | 12 | 1.50 |
| 2 The Orange Switch | 9 | 16 | 12 | 1.33 |
| 3 The Locked Garden | 10 | 24 | 14 | 1.40 |
| 4 Only When | 9 | 14 | 11 | 1.22 |
| 5 The Garden Shifts | 13 | 20 | 16 | 1.23 |

## Known weaknesses / open questions
1. Levels 2–5 still have `E` ≥ optimal, so a player *can* rehearse the full route in Scout. That is intentional for teaching, but it means the run measures recall and execution there. Real strictness starts in M4 levels.
2. Free reset in Scout cannot be abused for infinite experiments because every other action still spends Scout budget; an AI runner still needs a hard cap on total calls.
3. Whether finding the exit in Scout should auto-start the run (current) or just show a marker is a feel question for playtests.
4. The AI card says "Scout 16 · Run 12" so the parity is visible to the player.
