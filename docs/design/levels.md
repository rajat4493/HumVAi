# The Experiment — Levels 1–5 (exact specification)

Everything here is implemented in `packages/game-core/src/levels/*.ts` and machine-verified by `npm run verify:levels`
(see `docs/verification/solvability-report.md`). If this document and the code disagree, the code and tests win; fix the document.

## Shared rules (all levels)

**Grid.** Orthogonal, tile-based. Coordinates are `(x, y)` with `(0,0)` top-left. Every map is fully enclosed by walls.

**Actions** (identical for human and AI):

| Action | Effect | Costs budget? |
|---|---|---|
| `MOVE up/down/left/right` | Move one tile. Walking into a wall, closed door or switch is a no-op *bump*. Walking into a block pushes it one tile if the tile behind it is floor/plate/tripwire (not wall, door, switch, exit, other block). | **Yes**, even when bumped |
| `INTERACT targetId` | Toggle a switch that is orthogonally adjacent. Anything else is rejected. | **Yes** when accepted |
| `RESET` | Restore the world to its start. Budget is **not** restored. | **Yes** (1) |
| Rejected action (non-adjacent/unknown target, anything after game end) | `valid:false`, world unchanged | No, but counted in `rejectedActions` |

**Win:** the player stands on the exit tile. Checked before the budget, so winning on the last action is a win.
**Lose:** `actionsUsed >= budget` without winning.
**Doors:** a door the player is standing in stays passable for them; doors block *entry* only. Blocks can never be pushed onto doors.
**Plates:** pressed while the player *or a block* is on them. **Tripwires:** fire once when the player or a block first enters.
**Determinism:** same level + same action list ⇒ identical outcome and identical `finalStateHash`.

**What the player/AI is told:** the briefing text, the symbols, the budget, and the full public state. **What is hidden:** which signal controls which door, which switches are jammed or decoys, and that the world can change. Hidden rules never appear in any observation (tested).

**AI observation format.** The AI receives `PublicGameState` (JSON) and/or its ASCII rendering plus the list of legal actions, and replies with one `GameAction`. ASCII legend: `#` wall · `.` floor · `@` you · `E` exit · `B` block · `D`/`d` door closed/open · `s`/`S` switch off/on · `P`/`p` plate idle/pressed · `W`/`w` tripwire armed/spent. Below each map the observation lists entities as `id=kind(state)@x,y` and a status line `actions used/budget epoch status`. JSON example (level 2, start):

```json
{ "challengeId": "w02-orange-switch", "version": 1, "width": 9, "height": 5,
  "tiles": ["#########","#...#...#","#.......#","#...#...#","#########"],
  "player": {"x":1,"y":1}, "exit": {"x":7,"y":1},
  "entities": [
    {"id":"switch-orange","kind":"switch","pos":{"x":2,"y":2},"state":"off"},
    {"id":"door-garden","kind":"door","pos":{"x":4,"y":2},"state":"closed"},
    {"id":"switch-teal","kind":"switch","pos":{"x":2,"y":3},"state":"off"} ],
  "budget": 14, "actionsUsed": 0, "actionsRemaining": 14, "epoch": 0, "status": "playing" }
```

(`tiles` shows only walls/floor; doors are listed as entities, and door tiles appear as `.` there.)

**Event feedback** (also what drives animation): `MOVED, BLOCKED(reason), PUSHED, SWITCH_TOGGLED, NO_EFFECT, DOOR_OPENED/CLOSED, PLATE_PRESSED/RELEASED, EPOCH_CHANGED, RESET, WON, LOST, REJECTED`. `NO_EFFECT` deliberately gives no reason.

**Level IDs are versioned.** Changing a map or rule must bump `version`; old results then refer to the old definition.

---

## Level 1 — First Steps (`w01-first-steps`, v1)

| | |
|---|---|
| **Learning objective** | Movement, walls, "every action spends budget" |
| **Difficulty** | 1 / 5 |
| **Budget** | 12 actions (optimal 8, slack 4) |
| **Objective** | Reach the glowing exit |
| **Briefing** | "Reach the glowing exit. Walls block the way. You have 12 actions." |

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
- **Failure:** 12 actions without reaching the exit.
- **Reachable states:** 11. **Dead states:** 0.
- **Visual/animation:** exit pulses and slowly rotates; player squashes on each step; wall bump = 9 px nudge; win = confetti burst from the exit + player pulse.

## Level 2 — The Orange Switch (`w02-orange-switch`, v1)

| | |
|---|---|
| **Learning objective** | Switches change the world; some do not matter |
| **Difficulty** | 2 / 5 |
| **Budget** | 14 (optimal 9, slack 5) |
| **Objective** | Reach the exit behind the door |
| **Briefing** | "The exit is behind a door. Two switches sit nearby. Find out what they do. You have 14 actions." |

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
- **Alternatives:** 6 distinct optimal sequences (toggle from (2,1), (1,2) or (3,2); the post-door walk can turn up at three points). Exploring the decoy first costs 12 of 14 actions (verified by test), so one honest experiment is affordable.
- **Failure:** budget exhausted; or toggling orange twice (door closes again).
- **Reachable states:** 48. **Dead states:** 0 (switches are reversible).
- **Visual/animation:** switch lights up and pulses; door panel swaps to an open frame with a green glow and pulses. Decoy toggles with the same animation so it is *not* distinguishable by feedback alone.

## Level 3 — The Locked Garden (`w03-locked-garden`, v1)

| | |
|---|---|
| **Learning objective** | Objects can do what the player cannot: hold a plate while you walk away |
| **Difficulty** | 3 / 5 |
| **Budget** | 16 (optimal 10, slack 6) — matches the plan's "10 moves" example |
| **Objective** | Reach the exit behind the door |
| **Briefing** | "The exit is behind a door. The purple block can be moved. Discover how the world works. You have 16 actions." |

```
#########
#@......#    start (1,1)
#.B.p##D#    B = block-purple (2,2) ; p = plate-garden (4,2) ; D = door-garden (7,2)
#...###E#    exit (7,3)
#########
```

- **Visible:** a plate, a door, a pushable block (four-arrow glyph).
- **Hidden:** `door-garden` is open iff `plate-garden` is pressed. The block counts as a press; the player does too, but cannot be in two places.
- **Intended solution (10):** `D R R U R R R R D D` — push the block right twice onto the plate, step up, walk the corridor, through the door.
- **Alternatives:** 1 distinct optimal. Non-optimal: push the block down/up first (wasteful), step on the plate to learn that it opens the door (costs ~4 extra, affordable).
- **Failure:** budget exhausted; or an *unrecoverable block* (pushed into a corner or against the wall) — only `RESET` (cost 1) recovers, and a mistake made after action 5 can no longer be recovered within 16.
- **Reachable states:** 178. **Dead states:** 137 (the block can be stranded in many ways — see audit risk G3).
- **Visual/animation:** block slides 140 ms; plate depresses and turns green when pressed; door opens with glow. Plate must read as "press here" (chevron) without colour.

## Level 4 — Only When (`w04-only-when`, v1)

| | |
|---|---|
| **Learning objective** | An action can depend on the state of something else; failure is information |
| **Difficulty** | 4 / 5 |
| **Budget** | 14 (optimal 9, slack 5) |
| **Objective** | Reach the exit behind the door |
| **Briefing** | "The exit is behind a door. Three switches line the corridor. Not everything works all the time. You have 14 actions." |

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
- **Reachable states:** 76. **Dead states:** 0.
- **Visual/animation:** a jammed switch shakes (3 × 5 px) and does **not** change appearance; no text explains why. This is the "failure is information" beat.

## Level 5 — The Garden Shifts (`w05-garden-shifts`, v1)

| | |
|---|---|
| **Learning objective** | The world can change its rules; a good strategy notices and adapts |
| **Difficulty** | 5 / 5 |
| **Budget** | 22 (optimal 10, slack 12) |
| **Objective** | Reach the exit through two doors |
| **Briefing** | "Two doors, two switches. What you learn may not stay true. You have 22 actions." |

```
############
#@..D..W.DE#   start (1,1)  D = door-gate (4,1)  W = tripwire-tide (7,1)  F = door-far (9,1)  exit (10,1)
#.s.#s.#####   s = switch-one (2,2) ● orange circle ; switch-two (5,2) ◆ blue diamond
############
```

- **Visible:** two doors, two switches, a glowing rune tile (tripwire) between them. Both switches start OFF.
- **Hidden:** Phase 0 — `door-gate` open iff `switch-one` ON; `door-far` open iff `switch-two` ON. The first time anything enters the tripwire, the world enters **phase 1** and *every door rule is inverted* (open iff the signal is OFF). The shift is announced only by a visible cue (`epoch` becomes 1; the floor tints violet and the screen flashes), never explained.
- **Intended solution (10):** `R [one] R R R R R R R R` — open the gate, walk on; the tripwire inverts the far door, which opens by itself because `switch-two` is OFF.
- **Naive-but-valid path (18, verified):** also turn `switch-two` ON in phase 0 (as level 2 taught), trip the wire, watch the far door slam shut, walk back, turn it OFF, return. Still inside 22.
- **Alternatives:** 1 distinct optimal. After the shift, `door-gate` closes behind the player; there is no way back through it, which is harmless because the level is forward-only.
- **Failure:** budget exhausted (e.g. repeatedly bumping the closed far door).
- **Reachable states:** 40. **Dead states:** 0.
- **Visual/animation:** tripwire pulses while armed and dims when spent; on shift: camera flash, floor tint, door textures re-evaluate. Reduced-motion: no flash, tint only.
- **Known weakness:** a player who never touches `switch-two` completes it without noticing the shift (audit risk G4).

---

## Proof of solvability

`solve()` runs a breadth-first search over canonical world states using the real `stepInternal` transition (not a separate model), without a budget cap, and reports the shortest win, the number of distinct shortest sequences, the whole reachable graph and the number of dead states. The shortest solution is then **replayed from scratch** through `replay()` and must win in exactly that many actions. Results: `docs/verification/solvability-report.md`. Both the script and Vitest assert this for all five levels.
