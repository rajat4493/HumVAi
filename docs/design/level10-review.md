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

## After the review: worlds 11-20 (built under those rules, not yet reviewed with the same rigour)
- **One new mechanic, added only where nothing else gave variety: spring switches.** A switch turns itself off a fixed number of *actions* later (not seconds, so it is fair to a person on a phone and to a model). It adds the one thing the other mechanics could not: time as a resource ("prepare, then dash", "two timers that must overlap"). Used in worlds 17-20. Nothing tells the player the timer; they see the switch pop back (toast, sound, screen-reader text). Verified: engine unit tests, solver, replay, and each world won in a browser.
- **Chapter 3 (11-12; 9-10 were reviewed above):** pulling a block (11) and logical deduction with four switches (12).
- **Chapter 4 (13-16):** the world shifts (13, existing), a rule reverses (14), links swap (15), and the puzzle you solved first is not needed (16). Known weakness: World 16 is won in six actions by anyone who walks straight to the exit, so its lesson lands only for players who tried the block first. Worth watching in playtests; it may be better as a hint-free "breather" than a chapter piece.
- **Chapter 5 (17-20):** spring switches, two timers, a timed chain, and a finale that needs a held plate, a hidden rune and a timed switch in the right order. Known risks: World 19 is a 21-step walk across an open room (tedium risk, many equivalent routes); World 20 is 25 actions with about seven decisions and several irreversible states (recoverable in Scout, costly in the Run); World 18 is 11 tiles wide, one over the 10-tile guideline.
- **Still true of all 20:** no person has played any of them. Difficulty is likely too low for chapters 1-3 and unknown for 4-5 until real play and real AI attempts exist; budgets are the lever and are cheap to change (version bump).
