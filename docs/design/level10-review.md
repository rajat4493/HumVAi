# Level 10 gameplay-quality review

Scope: the first ten worlds in campaign order (at the time of the review *The Garden Shifts* was World 11; it is now World 13, the first of chapter 4).
Method: solver metrics (`tools` lab), reading every briefing and hint, screenshots on desktop (1280x760) and phone (390x780), and playing every world through the real controls in a browser (`tests/e2e/campaign.spec.ts`).
**Not done: no person has played these worlds.** Everything below about enjoyment is a structured judgement, not evidence. Human playtests remain the gate that matters most.

## Campaign order reviewed
| # | World | Chapter | The discovery | Optimal run |
|---|---|---|---|---|
| 1 | First Steps | Awakening | Move; walls; the exit | 8 |
| 2 | The Orange Switch | Awakening | Not every switch matters (decoy) | 9 |
| 3 | Both Needed | Awakening | A door can need two things at once | 12 |
| 4 | Off Is On | Awakening | Starting state matters, "lit" is not "good" | 9 |
| 5 | The Locked Garden | The Unknown | A block can hold a plate for you | 10 |
| 6 | Only When | The Unknown | A switch that fails is information | 9 |
| 7 | Corner Piece | The Unknown | A block goes only where you can stand behind it | 15 |
| 8 | Hold the Line | The Unknown | A switch can depend on a held plate | 12 |
| 9 | In Order | The Strategist | Dependencies form a chain; then let go of the first | 16 |
| 10 | Heavy Load | The Strategist | One job unlocks the next: plan the order | 13 |

## Findings
**Mechanic diversity: good.** Ten different "aha" moments, no mechanic repeated as the same idea. Four worlds involve blocks (5, 7, 8, 10) but ask different questions (hold, turn, gate a switch, sequence). Worlds 7 and 8 are adjacent block worlds; they differ enough (a turn versus a gated switch) to keep, but no third follows.
**Difficulty progression: flat, and that is the main risk.** Optimal lengths run 8-16 with no upward trend. The concept load rises (decoy, conjunction, state, dependency, order) but the *search* is small: most worlds are solved by a person within two Scouts. That is right for chapters 1-2. Chapters 3-5 must raise depth (more hidden rules interacting, misleading states, rule shifts), not length. Solver complexity is not the goal; a world is only worth keeping if it ends in a moment of "oh".
**Repetition: one pattern is overused.** Worlds 3, 4, 6 and 9 (and, loosely, 2) are a single corridor with switches in alcoves. Fixed for what follows: new worlds use two-dimensional rooms or multiple areas.
**Understandable without long instructions: yes, with two soft spots.** No world has a tutorial; Scout is the teacher and every new idea is first met safely. Failure is perceivable (shake, sound, "nothing happened" toast, screen-reader text). Soft spots: World 4 (the player must realise "already lit" is not the goal) and World 9 (the player must notice that two switches ignore them). Both are covered by hint tier 1, and neither can be seen as a dead end because nothing is ever lost in Scout.
**Meaningful discovery: yes for all ten.** World 4 is the thinnest (one toggle solves it, about even odds on a first guess); it works as a short breather after World 3.
**Frustrating or tedious interactions found and fixed**
1. Standing between two switches, Interact always chose the first, so a person could not do what the solver and an AI can. Fixed: Interact prefers the side last moved toward; Shift+arrow picks a side at no extra action; tapping the board picks the nearest adjacent switch or block. Tested in a browser on keyboard and touch.
2. World 3 (old layout) had eight-step straight walks; World 10 walked a long loop between two blocks. Both redrawn shorter; budgets retightened (World 10 is now also a real planning level: the first block opens the way to the second).
3. Older saves: inserting worlds before a finished one could have locked it. A world is now playable if it or any later world is already finished (tested).
4. The world map orphaned a fourth world on a second row; now four per row.
**Hints: useful without giving the game away, by design.** Tier 1 points attention, tier 2 states the rule, tier 3 gives the route; any hint marks the run assisted (no personal best, no achievements). Tightened World 4's tier 2 so it no longer states the answer. A hint test (distinct, non-trivial) exists; whether people *feel* helped is untested.
**Mobile and feel.** Controls are the pad, swipe and tap. Wide boards (World 9 is 13 tiles) draw tiles near 28 CSS px on a 390 px phone, below the 44 px comfort size; the pad buttons stay 44+ and tapping now forgives misses, but a wide world on a phone is the weakest point. Mitigation for later worlds: keep boards at most 10 tiles wide, or two rows. Visual clarity of shapes, colours and the exit is good in screenshots; animation and sound pass is scheduled after the last world.

## Decision
No serious design issue requiring approval. Proceeding with chapters 3-5 under three rules learned here: depth over length, 2-D rooms instead of corridors, boards at most 10 tiles wide.

## Worlds 11-20, reviewed against the same criteria (second pass)
Method as above plus a redesign round driven by the findings. Still **no human has played any of them**; "fun" below is judgement, not evidence.

| # | World | Discovery | Optimal | Verdict after the pass |
|---|---|---|---|---|
| 11 | Against the Wall | Interact pulls a block, so "stuck" is not stuck | 14 | Keep. Clear single insight; 14 actions with no filler. |
| 12 | Combination | Work out a four-switch rule by watching the door | 13 | Keep. Real deduction; slack is small (13 of 15), watch in playtests. |
| 13 | The Garden Shifts | The world changes its rules (existing world) | 11 | Redrawn to 10 tiles wide; same logic. |
| 14 | Reversal | A rule you relied on reverses | 7 | Keep as a short beat. |
| 15 | Swapped Wires | Which switch opens which door changes | 8 | Keep as a short beat. |
| 16 | The Simple Way | The puzzle you solved first is not the cheapest | 7 | **Redesigned** (see below). |
| 17 | Spring Loaded | Time is a resource: a switch lets go by itself | 11 | Keep. Introduces the one new mechanic with no other load. |
| 18 | Two Springs | Overlapping timers: the order decides everything | 12 | Narrowed from 11 to 9 tiles; the walk is the point (timers vs distance). |
| 19 | Two of Three | Any two of three fading switches; use the longest-lasting first | 10 | **Redesigned** (see below). |
| 20 | The Last Experiment | Plate + rune + timed switch in one room | 15 | **Redesigned** (see below). |

**World 16.** Before: the rune sat on the only path, so anyone walking to the door won in six actions and never met the idea. Now: the rune is off the path, the block puzzle is solvable but costs 15 actions against a 10-action run, and the rune route costs 7. Intended insight, not an accident: *after the world changes, the obvious puzzle can be the expensive one*. A person who solves the block first learns it in Scout and fails the budget deliberately; a person who steps on the rune first gets the door for free. Gated by a test (block-first route longer than the run budget) and by `verify:levels` ("essential by budget").
**World 19.** Before: a 21-step walk across an open room with 90 equivalent routes, so the decisions were mostly walking. Now: three switches around the start, a rule (any two lit at once) and unequal timers (5, 5, 9). Decisions: which switch first, which pair, where to stand. 10 actions, a test that the longest-lasting switch must come first, no walking filler.
**World 20 (finale).** Before: two rooms, a gate, 25 actions, and a lot of straight walking. Now: one visible room, a sealed exit, a block and plate, a rune and one fading switch; 15 actions. Understandable failure: every element is on screen from the start, each fails visibly (the switch pops back with a sound and a ring; the door stays sealed until the rune is stepped on), and a lost Run says Try again starts with a fresh Scout. Fair recovery: no dead states (solver-checked), Scout is generous (30 against 15), and the Run has 19. Payoff: a short ending screen with the player's own results and an honest statement about the AI. Difficulty comes from combining three rules, not from walking.
**Phones.** Every board is at most 10 tiles wide (worlds 5, 7, 10 and 18 were redrawn) and a browser test asserts tiles of at least 36 CSS px on a 390 px phone for every world. Zoom and scrolling boards were considered and not built: with the width cap they are unnecessary, and a partly visible board would hurt planning. Touch accuracy: a tap picks the nearest adjacent switch or block within about one tile; a soft ring marks what Interact will act on.
**Risks that remain.** Chapters 1-3 are likely too easy for some players and chapter 4's worlds 14-15 are brief; budgets are the lever (a version bump). World 12's tight Run slack and World 20's three-rule combination are the likeliest frustration points. None of this is verified by people.
