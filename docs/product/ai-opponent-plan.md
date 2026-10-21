# The AI opponent — plan for M1 and M2 (proposal; nothing here is implemented)

> Elaborated for the M1 preparation gate in `docs/ai/experiment-spec.md` (experiment), `docs/design/rivalry-experience-spec.md` (UX) and `docs/product/m1-implementation-plan.md` (work packages). Where they differ, those documents win.

Goal: Humans vs AI must be a contest between two kinds of intelligence, not puzzles with an AI badge. The AI is a real model acting through the same engine; the comparison must be fair, verifiable and presented without theatre.

## 1. Fairness model

**Identical for both sides (enforced by the engine, not by trust):**
1. The same world definition, version and seed.
2. The same Scout budget and Run budget (`docs/product/budget-model.md`).
3. The same action vocabulary: `MOVE`, `INTERACT`, `RESET`, `COMMIT`.
4. The same information: `PublicGameState` after every action, plus the events caused by that action. The web UI is rendered *only* from this object, so anything a human can see an AI can be given.
5. The same hidden rules, never disclosed to either side. The briefing text is the same string.
6. The same rejection semantics (illegal actions rejected, free, counted).
7. The same scoring, computed by the deterministic engine and re-checked by `replay()`.

**Declared differences (reported, never scored):** modality (pixels and animation vs structured text), memory (the human's head vs the AI's scouting transcript carried into the Run), thinking time (human unlimited and real-time; AI capped by tokens/seconds), prior exposure to this game (humans may have played before; the AI is given no prior attempts or solutions unless an explicitly labelled "learning across attempts" mode is used).

**Anti-cheating for the AI side:**
- The AI never receives internal state, hidden rules, the solver, or the level source. It gets the generic game rules (actions, phases, budgets) in a versioned system prompt that is the same for every level.
- Entity IDs must be neutral (`switch-1`, not `switch-decoy`): add an ID linter in M1.
- The server runs the engine. The model only proposes an action; the server validates and executes it.
- Hard limits: at most `E + X + 20` calls and 20 rejected actions per attempt, a per-decision token cap and wall-clock cap, one fixed temperature and model version per experiment.
- A single run is an anecdote. Each (model, config, world) is sampled **N times** (proposal: N = 20) and the result is a success rate with its run-length distribution.

## 2. What the AI sees (frozen format, snapshot-tested)

Each turn the model receives:
```
GAME RULES (generic, versioned)         # actions, phases, budgets, "hidden rules exist"
BRIEFING                                # the same text the human reads
OBSERVATION (JSON PublicGameState)      # exactly what observe() returns
BOARD (ASCII, from renderAscii)         # redundant, for legibility
LAST EVENTS                             # events from the previous action (MOVED, BLOCKED, NO_EFFECT, DOOR_OPENED ...)
LEGAL ACTIONS                           # from legalActions()
HISTORY                                 # all earlier observations/actions this attempt, including the Scout transcript
```
and replies with one JSON object: `{ "action": <GameAction>, "note": "<one short sentence>" }`. The `note` is a *self-reported* explanation (shown to players, labelled as such; it may not reflect the model's actual computation). Private reasoning is not stored or shown.

## 3. Scoring and results

Per participant: `(won, runActions, scoutActions)` from the engine.

Comparison (deterministic, written down before any data exists):
1. Won beats lost.
2. Both won: fewer `runActions` wins.
3. Equal `runActions`: fewer `scoutActions` wins ("discovery efficiency").
4. Equal on both: **tie**.
5. If the AI side has no valid, replay-verified attempt (provider error, forfeit by rejection cap, invalid log): **inconclusive**, never an automatic human win.

Against the AI's *distribution* the reveal reports: "Solved by the AI in k of N attempts; median run length m; fastest f." The player's result is placed against that, plus the single recorded attempt shown (below). No points for "creativity" or "style" until a reliable measurement exists. A human result is only ever called a *record* or a *discovery* after server replay.

## 4. Presenting recorded attempts transparently

- Always labelled **RECORDED**, with model name and version, date, configuration id, attempts-solved ratio (k of N), and cost/latency in a details panel. Never styled as "thinking now". A live mode may exist later but must be labelled **LIVE** and shows real latency.
- Shown **after** the human's run ends (no spoilers). Played as a ghost on the same board with the Scout condensed and the Run at normal speed, plus the AI's self-reported notes, labelled as such.
- Which attempt is shown is decided by a published rule before sampling (the attempt whose run length is the median among successes; if none succeeded, the attempt that got closest, labelled "unsuccessful"). Never cherry-picked.
- Every recorded attempt was replayed by the server before it can be shown; a failed replay hides it.
- "How was this recorded?" links to the exact system prompt, settings and sample count.
- Wins and losses of the AI are presented with the same weight; the UI never mocks either side.

## 5. Delivery

**M1 (no real AI). Build the seams, not the opponent.**
1. `RunRecord` format: world id and version, seed, full action list (including `COMMIT`), counts, outcome, state hash. Humans produce one at the end of every attempt; saved locally.
2. Result reveal v0: the player's own run as a ghost replay; three result layouts (human ahead, AI ahead, tie/inconclusive) built against fixtures. Any fixture opponent is labelled **"Reference solver (not an AI)"**.
3. Freeze and snapshot-test the AI observation/prompt format; add the neutral-ID linter.
4. Decide §6 questions.

**M2 (real AI).**
1. `packages/ai-adapters`: provider-neutral `decide(observation) → action`, with model identity, parameters, token cost and latency recorded per call.
2. An offline batch runner: N attempts per (model, world), through the real engine, with the limits above. Output = `RunRecord`s plus model-run metadata.
3. Replay verification of every record; reproducibility check (same recorded actions replay to the same hash).
4. **Difficulty calibration before content scaling:** measure AI success rate and run length for each world. Adjust budgets (Scout below the optimum for hard worlds), and if the AI solves everything instantly, move to parameterised/seeded variants (rewired switches, new layouts) and larger worlds. This is the main product risk (audit G1).
5. Result reveal v1 with recorded attempts exactly as in §4.
Gate (from the plan): verified AI action logs, reproducible outcomes, measured cost and latency.

## 6. Decisions needed from you before M2
1. Which model(s) and how many samples N (cost grows linearly).
2. Whether ties break on scouting efficiency (proposed) or stay ties.
3. Whether the AI may keep its scouting transcript during the Run (proposed yes, the analogue of human memory).
4. Whether to show the AI's self-reported note, given it may not reflect its real reasoning (proposed yes, labelled).
5. The acceptance band for "good contest" worlds (proposed: AI success rate between 15% and 85%).

## 7. Risks
- Worlds too easy or too hard for LLMs (calibrate first).
- Training-data contamination if world descriptions become public (use seeded variants).
- Sampling noise misread as skill (always report N and distributions).
- Perceived unfairness from the ASCII vs animation difference (publish the exact observation).
- Cost and latency (batch offline; recorded-first design avoids per-move waits).
