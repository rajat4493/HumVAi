# The Experiment — Levels 1–5 (exact specification)

Everything here is implemented in `packages/game-core/src/levels/*.ts` and machine-verified by `npm run verify:levels`
(see `docs/verification/solvability-report.md`). If this document and the code disagree, the code and tests win; fix the document.

## Shared rules (all levels)

**Grid.** Orthogonal, tile-based. Coordinates are `(x, y)` with `(0,0)` top-left. Every map is fully enclosed by walls.

**Budget model: Scout & Run** (`docs/product/budget-model.md`). Each world has a Scout budget `E` (a sandbox where nothing can win or lose; `RESET` is free) and a Run budget `X` (the strict, scored attempt on a fresh world). Scouting ends on `COMMIT` or when `E` is spent (reaching the exit in Scout only reports `EXIT_FOUND`; the player commits explicitly); the world then resets and the run begins. Worlds with `E = 0` start directly in the run.

**Actions** (identical for human and AI):

| Action | Effect | Costs budget? |
|---|---|---|
| `MOVE up/down/left/right` | Move one tile. Walking into a wall, closed door or switch is a no-op *bump*. Walking into a block pushes it one tile if the tile behind it is floor/plate/tripwire (not wall, door, switch, exit, other block). | Yes, even when bumped |
| `INTERACT switchId` | Toggle an orthogonally adjacent switch. | Yes |
| `INTERACT blockId` | **Drag**: with the block orthogonally adjacent, the player steps directly away and the block follows into the vacated tile. If there is no room, `NO_EFFECT`. | Yes |
| `RESET` | Restore the world to its start; budgets are not restored. | Free in Scout; 1 action in the Run |
| `COMMIT` | End scouting, start the run (Scout only). | Free |
| Rejected action (non-adjacent/unknown target, `COMMIT` in the run, anything after game end) | `valid:false`, world unchanged | No, but counted in `rejectedActions` |

**Win:** the player stands on the exit tile **during the run** (checked before the budget, so winning on the last action is a win). Reaching the exit while scouting wins nothing and does not end scouting. **Lose:** `X` run actions spent without winning.
**Doors:** a door the player is standing in stays passable for them; doors block *entry* only. Blocks can never be pushed or dragged onto doors.
**Plates:** pressed while the player *or a block* is on them. **Tripwires:** fire once when the player or a block first enters.
**Determinism:** same level + same action list ⇒ identical outcome and identical `finalStateHash`.

**What the player/AI is told:** the briefing text, the symbols, the budget, and the full public state. **What is hidden:** which signal controls which door, which switches are jammed or decoys, and that the world can change. Hidden rules never appear in any observation (tested).

**AI observation format.** The AI receives `PublicGameState` (JSON) and/or its ASCII rendering plus the list of legal actions, and replies with one `GameAction`. ASCII legend: `#` wall · `.` floor · `@` you · `E` exit · `B` block · `D`/`d` door closed/open · `s`/`S` switch off/on · `P`/`p` plate idle/pressed · `W`/`w` tripwire armed/spent. Below each map the observation lists entities as `id=kind(state)@x,y` and a status line `actions used/budget epoch status`. JSON example (level 2, start):

```json
{ "challengeId": "w02-orange-switch", "version": 2, "width": 9, "height": 5,
  "tiles": ["#########","#...#...#","#.......#","#...#...#","#########"],
  "player": {"x":1,"y":1}, "exit": {"x":7,"y":1},
  "entities": [
    {"id":"switch-orange","kind":"switch","pos":{"x":2,"y":2},"state":"off"},
    {"id":"door-garden","kind":"door","pos":{"x":4,"y":2},"state":"closed"},
    {"id":"switch-teal","kind":"switch","pos":{"x":2,"y":3},"state":"off"} ],
  "phase": "explore", "scout": {"budget": 16, "used": 0}, "run": {"budget": 12, "used": 0},
  "actionsRemaining": 16, "epoch": 0, "status": "playing" }
```

(`tiles` shows only walls/floor; doors are listed as entities, and door tiles appear as `.` there.)

**Event feedback** (also what drives animation): `MOVED, BLOCKED(reason), PUSHED, PULLED, SWITCH_TOGGLED, NO_EFFECT, DOOR_OPENED/CLOSED, PLATE_PRESSED/RELEASED, EPOCH_CHANGED, RESET, COMMITTED(reason), WON, LOST, REJECTED`. `NO_EFFECT` deliberately gives no reason.

**Level IDs are versioned.** Changing a map, rule or budget must bump `version`; old results then refer to the old definition. (M0 review: Worlds 1–4 moved to v2 because the budget model changed; World 5 moved to v2 because its rules changed.)

---

## Level 1 — First Steps (`w01-first-steps`, v2)

| | |
|---|---|
| **Learning objective** | Movement, walls, "every action spends budget" |
| **Difficulty** | 1 / 5 |
| **Budget** | Scout 0 · Run 12 (optimal 8, slack 4). Nothing hidden, so no scouting |
| **Objective** | Reach the glowing exit |
| **Briefing** | "Reach the glowing exit. Walls block the way." |

```
#######
#@..#E#      start (1,1)   exit (5,1)
#.#.#.#
#.#...#
#######
```

- **Visible rules:** walls block; budget.  **Hidden rules:** none (deliberate — onboarding).
- **Intended solution (8):** `R R D D R R U U`. The left column and the (1,2)–(1,3) pocket are dead ends.
- **Alternative solutions:** no other optimal route (1 distinct). Longer routes exist by wasting ≤4 actions (bumps, back-and-forth).
- **Failure:** 12 run actions without reaching the exit.
- **Reachable states:** 10. **Dead:** 0.
- **Visual/animation:** exit pulses and slowly rotates; player squashes on each step; wall bump = 9 px nudge; win = confetti burst from the exit + player pulse.

## Level 2 — The Orange Switch (`w02-orange-switch`, v2)

| | |
|---|---|
| **Learning objective** | Switches change the world; some do not matter |
| **Difficulty** | 2 / 5 |
| **Budget** | Scout 16 · Run 12 (optimal 9, slack 3) |
| **Objective** | Reach the exit behind the door |
| **Briefing** | "The exit is behind a door. Two switches sit nearby. Find out what they do." |

```
#########
#@..#..E#    start (1,1)  exit (7,1)
#.s.D...#    s = switch-orange (2,2) ● orange circle ;  D = door-garden (4,2)
#.s.#...#    s = switch-teal   (2,3) ▲ teal triangle
#########
```

- **Visible:** a locked door, two switches (different shape *and* colour), both start OFF.
- **Hidden:** `door-garden` is open iff `switch-orange` is ON. `switch-teal` is a decoy: it toggles visibly and does nothing else.
- **Intended solution (9):** `R R D [orange] R R U R R` (reach a tile beside the orange switch, toggle it, walk through).
- **Alternatives:** 6 distinct optimal sequences (toggle from (2,1), (1,2) or (3,2); the post-door walk can turn up at three points). Testing the decoy first costs 12 actions: affordable even in a strict run (verified), and free of consequence in Scout.
- **Failure:** budget exhausted; or toggling orange twice (door closes again).
- **Reachable states:** 46. **Dead:** 0. **Irreversible:** 0 (switches are reversible).
- **Visual/animation:** switch lights up and pulses; door panel swaps to an open frame with a green glow and pulses. Decoy toggles with the same animation so it is *not* distinguishable by feedback alone.

## Level 3 — The Locked Garden (`w03-locked-garden`, v2) — *revised after M0 review*

| | |
|---|---|
| **Learning objective** | Objects can do what the player cannot: hold a plate while you walk away. Mistakes are recoverable |
| **Difficulty** | 3 / 5 |
| **Budget** | Scout 24 · Run 14 (optimal 10, slack 4). Matches the plan's "10 moves" example |
| **Objective** | Reach the exit behind the door |
| **Briefing** | "The exit is behind a door. The purple block can be pushed, and dragged with Interact. Discover how the world works." |

```
#########
#@......#    start (1,1)
#.B.p##D#    B = block-purple (2,2) ; p = plate-garden (4,2) ; D = door-garden (7,2)
#...###E#    exit (7,3)
#########
```

- **What changed and why.** The M0 version let a block be pushed into a corner or against a wall for good: **137 of 178 reachable states (77%) were dead** and only a costed RESET recovered. The map is unchanged, but the block can now also be **dragged** (`INTERACT` on an adjacent block: the player steps back, the block follows). A block against a wall or in a corner can always be pulled back out along the open side, so the pushing mistakes that used to be fatal are now just moves.
- **Result (exhaustive search):** 183 reachable states, **0 dead, 0 irreversible** (every state can still reach the exit *and* return to the start without RESET). Optimal is still 10 with 1 distinct optimal sequence, so the puzzle did not get easier to solve, only safer to explore.
- **Visible:** a plate, a door, a pushable block (four-arrow glyph); the briefing says the block can be pushed and dragged.
- **Hidden:** `door-garden` is open iff `plate-garden` is pressed. The block counts as a press; the player does too, but cannot be in two places. The block is still required (without it the exit cannot be reached; tested).
- **Intended solution (10):** `D R R U R R R R D D` — push the block right twice onto the plate, step up, walk the corridor, through the door.
- **Alternatives:** 1 distinct optimal. Non-optimal: step on the plate to see the door open (a few extra actions), push the block somewhere wasteful and drag it back.
- **Recovery paths:** block against the top wall → drag it down (`INTERACT`); block stuck on the plate when you wanted it off → drag; anything else → `RESET`, free in Scout.
- **Failure:** run budget exhausted.
- **Visual/animation:** block slides 140 ms on push and drag; plate depresses and turns green when pressed; door opens with glow. The plate reads as "press here" (chevron) without colour.

## Level 4 — Only When (`w04-only-when`, v2)

| | |
|---|---|
| **Learning objective** | An action can depend on the state of something else; failure is information |
| **Difficulty** | 4 / 5 |
| **Budget** | Scout 14 · Run 11 (optimal 9, slack 2) |
| **Objective** | Reach the exit behind the door |
| **Briefing** | "The exit is behind a door. Three switches line the corridor. Not everything works all the time." |

```
##########
#@.....DE#   start (1,1)  D = door-exit (7,1)  exit (8,1)
#.s.s.s###   s = switch-circle (2,2) ● (starts ON) ; switch-square (4,2) ■ ; switch-triangle (6,2) ▲
##########
```

- **Visible:** three switches (circle lit, others dark), a door.
- **Hidden:**
  1. `switch-triangle` is *jammed* while `switch-circle` is ON — `INTERACT` returns `NO_EFFECT` and changes nothing.
  2. `door-exit` is open iff `switch-triangle` is ON **and** `switch-square` is OFF.
- **Intended solution (9):** `R [circle] R R R R [triangle] R R` (switch the circle off to un-jam the triangle, then turn the triangle on).
- **Alternatives:** 1 distinct optimal. Testing the square costs ≥2 extra actions and, if left ON, closes the door (must toggle back).
- **Failure:** budget exhausted; giving up on the triangle after a `NO_EFFECT`; leaving the square ON.
- **Reachable states:** 74. **Dead:** 0.
- **Visual/animation:** a jammed switch shakes (3 × 5 px) and does **not** change appearance; no text explains why. This is the "failure is information" beat.

## Level 5 — The Garden Shifts (`w05-garden-shifts`, v2) — *rebuilt after M0 review*

| | |
|---|---|
| **Learning objective** | The world can change its rules; what you learned about a switch may stop (or start) being true |
| **Difficulty** | 5 / 5 |
| **Budget** | Scout 20 · Run 16 (optimal 13, slack 3) |
| **Objective** | Reach the exit through two doors |
| **Briefing** | "Two doors, two switches, and a strange rune. What you learn may not stay true." |

```
############
#@..D....FE#   start (1,1)  D = door-gate (4,1)  F = door-far (9,1)  exit (10,1)
#.a.#.w.b###   a = switch-one (2,2) ● orange circle ; w = tripwire-tide (6,2) rune ; b = switch-two (8,2) ◆ blue diamond
############
```

- **What changed and why.** In M0 the rule change was optional: a player who never touched `switch-two` simply walked through (audit risk G4). Now the far door is **sealed** in the world's first epoch (nothing opens it) and the rune rewires it to `switch-two`. The change is the only way out.
- **Visible:** a gate door, a far door, two switches, a glowing optional-looking rune in a side nook. Both switches start OFF.
- **Hidden:** Epoch 0: `door-gate` open iff `switch-one` ON; `door-far` can never open (`switch-two` toggles but does nothing: it looks like the decoy from World 2). The first time the player or a block enters the rune: **epoch 1** — `door-far` now opens iff `switch-two` is ON. The change is announced only by a cue (floor turns violet, frame glows, screen flash, toast "The world just changed"), never explained.
- **Intended solution (13):** `R [one] R R R D R U R R [two] R R` — open the gate, step on the rune, then switch on `switch-two` (now it works), walk through the far door. 6 distinct optimal sequences (order of detour and toggle).
- **Why the rule change is essential (proved, tested):**
  1. Exhaustive search with every epoch-1 state pruned finds **no winning sequence**: any strategy that ignores the change cannot succeed.
  2. Every winning line has the epoch change before the win.
  3. The "learned" strategy (open the gate, toggle `switch-two` beside the far door, walk through) fails and loses by budget.
  4. Toggling `switch-two` *before* the rune still works (the switch state carries over) but costs 17 actions; the strict run allows 16. Understanding the order matters under the Run budget, and Scout allows the experiment.
- **Failure:** run budget exhausted; bumping the sealed door forever.
- **Reachable states:** 71. **Dead:** 0. **Irreversible:** 37 (the rune cannot be un-stepped; the level is forward-only by design).
- **Visual/animation:** rune pulses while armed and dims when spent; on the change: camera flash, floor re-tints violet, frame glows violet, toast. Reduced motion: no flash/pulse; the tint and toast remain.
- **Known weakness:** with `E = 20` a player can find the whole route in Scout (the Scout budget exceeds the optimum). Intended at this tier; strict worlds come later (`budget-model.md`).

---

## Proof of solvability

`solve()` runs a breadth-first search over canonical world states using the real `stepInternal` transition (not a separate model), without a budget cap, and reports the shortest win, the number of distinct shortest sequences, the whole reachable graph and the number of dead states. The shortest solution is then **replayed from scratch** through `replay()` and must win in exactly that many actions. Results: `docs/verification/solvability-report.md`. Both the script and Vitest assert this for all five levels, plus: no dead states anywhere, and for Level 5 that no solution exists without the rule change.
