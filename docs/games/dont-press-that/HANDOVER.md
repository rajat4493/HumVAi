# DON'T PRESS THAT (M3): handover

Branch `claude/humans-vs-ai-plan-fz5yq0`. Starting point `e01a0b3` plus the two playtest fixes `8c69f58` and `46da2ad`. Final commit: see the last line of this file's history (`git log -1 -- docs/games/dont-press-that/HANDOVER.md`) and the ledger. **Not deployed. Not played by external players.**

## Human summary

I built the third game in the arcade: **DON'T PRESS THAT**, a one-screen rage platformer with five levels and a smug AI host called Professor Probably. You jump over things, things trick you, you die, and you are back in a quarter of a second. Each level hides one rule you can work out by dying twice: ceiling spikes that fall when you pass, spikes that spring out of vents if you jump early, a "helpful" star that turns gravity over, a beam that aims where it thinks you are going and changes its aim after you wait, and a last level where you run at a wall so the host shoots his own wall down. Then you press the button he told you not to press. It was the off switch.

The host is not an AI model. He is a set of 216 written lines picked by what you actually did, plus a notebook of predictions. His predictions are checked against what happened ("I predict you will jump too early": right or wrong), and his score is on screen. He gets rattled when he is wrong. You can turn him off; the game is the same.

What I can say: it works, it is tested hard in a real browser (every level beaten by the real game loop, on desktop and phone emulation), it is accessible by automated checks, and nothing leaves your device. What I cannot say: that it is fun. That needs you, and then 10 to 15 strangers.

## What you should personally play and judge (about 15 minutes)

1. **Open it** (after you deploy a preview): `#/dont-press-that`. Does the first screen make you want to press Play?
2. **Level 1:** do you laugh or swear when the ceiling falls? Do you try the red button on the ledge? After two deaths, do you know what to do?
3. **Level 2:** did you jump early? Did the vents feel fair after you saw them once? What did you think when the host's prediction was wrong?
4. **Level 3:** the star. Is "it flipped gravity" a good surprise or a controls-are-broken moment? Is walking on the ceiling fun?
5. **Level 4:** the beam. Could you read the marker? Did the note about waiting versus running make sense, or did it feel like the game was inconsistent?
6. **Level 5:** do you find the wall trick without the hint? Is the ending a payoff?
7. **With the host muted** (Escape, then mute): is it still a good game? This is the most important question in the whole project.
8. **On a phone:** can you play with your thumbs? Is the jump button where you want it?
9. Is **any death unfair**? Write down the level and where.
10. Does anything make you want to send it to a friend?

## What was built

| Area | What |
|---|---|
| Rules | `sim.ts`: pure 60 Hz simulation. Run, variable jump, coyote time, jump buffer, gravity flip, spikes, falling bar, springing vents, button, stars, cracked wall, a tracking/locking beam. No clock, no randomness, no DOM. |
| Levels | `levels.ts`: five 20 x 11 screens with the rules above |
| Host | `host.ts` + `lines.ts`: event-driven, three personalities, mute, composure; `predictions.ts`: falsifiable predictions and a ledger |
| Attempts | `session.ts`: respawn (at most 250 ms), restart, recorded inputs, the "what did you do last time" rule for level 4 |
| Screen | `render.ts` (2D canvas, Playful Futurism palette), `Play.tsx`, `Menu.tsx`, `Done.tsx`, `audio.ts` (synthesised effects) |
| Save | `storage.ts`: own key `hva.dpt.v1` (progress, settings, optional two-tap ratings) |
| Data | `events.ts` + a vocabulary in `telemetry/schemas.ts`: consent-gated, local-only, free text cannot enter |
| Tools | `solver.ts` (a search that plays the levels), `tools/dpt-solve.ts` (regenerates `solutions.ts`), `tools/dpt-lab.ts` (design bench) |
| Suite | registered as the third game, status **experimental**; nothing in The Experiment or Pattern Hunter changed |

No Phaser: this game needs none of its scene or physics machinery, and a pure simulation drawn to a canvas is deterministic and testable. The game's chunk is 25 KB gzipped and the suite's first screen grew by 1.3 KB gzipped.

## How it feels (design intent, not a finding)

Movement is snappy (full speed in 70 ms, stop in 60 ms), jumps are forgiving (coyote time, buffered presses, hazard hitboxes smaller than your body), the screen is one fixed picture so the trap is always in view, and a death costs a quarter of a second and a tiny puff. The first death in a level always gets an explanation from the host, and from the second you can work out the rule. Levels take 3 to 5 seconds when you know them. **Whether this adds up to "voluntary retry" is the unverified claim.**

## What was actually tested

See the ledger rows M3-1 to M3-12 in `docs/VERIFICATION-LEDGER.md`. In short:

- **Every level can be completed:** a search player (independent of the designer's solution) finds a way through each level; the recorded solutions replay from a clean start; and the same recorded inputs beat each level **in the real browser through the game's own loop** (desktop and phone emulation).
- **No soft-locks** (levels 1 to 3, exhaustive search of a coarse state graph): from every reachable state the player can still win or die. The scan is itself tested: a deliberately broken level is caught. Levels 4 and 5 have a clock (the beam), so there the test is: still winnable after waiting 20, 60 or 100 ticks at the start (level 4), and a search finds level 5.
- **Collision correctness:** under pseudo-random play on every level, including flipped gravity, the body never ends a tick inside a wall; forgiving spike hitboxes tested at the edge.
- **Deterministic traps:** same inputs, same events, same state; replaying recorded inputs reproduces the same death.
- **Fast respawn:** at most 15 ticks (250 ms) with no input; a fresh key press shortens it; measured in the browser at under 500 ms.
- **Keyboard and touch:** real keys; touch buttons held with pointer events; buttons at least 44 px; a quick tap shorter than a tick still counts.
- **Prediction integrity:** verdicts come only from recorded events, never change once given, are identical on replay; the ledger counts equal the entries; the confidence the host quotes is a count of your own attempts; personality and mute cannot change the simulation (same inputs, same world, under every setting).
- **Suite regression:** the whole existing browser suite, the catalogue test and the sub-path check pass; The Experiment's and Pattern Hunter's saves are untouched (byte comparison).
- **Accessibility:** axe scan of the menu, a level, the settings dialog and the ending: no serious or critical violations. This is an automated scan; the game is a real-time visual platformer and a screen reader cannot play it (see limitations).

## Known limitations (read these)

- **Fun, fairness and the host's value are unverified.** No human has played this but me, through automation, and the owner has not yet seen it. The playtest plan exists; it has not run.
- **Level difficulty is not tuned by data.** The levels are short; the numbers (window sizes, beam timings) are from design reasoning and search, not from watching people. Expect some traps to be too harsh or too easy.
- **It is a real-time visual game.** Screen-reader play is not possible. Keyboard and touch work; remapping keys and a high-contrast mode are not built. Motion can be reduced (no shake, no particles); there are no flashes above the safe limit (the only bright event is a 0.17 s beam once every 2 seconds), but that was reasoned, not measured with a photosensitivity analyser.
- **Only Chromium has played it in a browser test.** The cross-browser CI job includes this spec; its result is in the ledger.
- **No physical phone or tablet.** Touch is tested with Chromium's phone emulation. Multi-touch (left thumb + right thumb at once) is handled in code (separate pointers) but only tested with one pointer at a time.
- **The beam in level 4 punishes the opposite of last time.** Players may find that confusing or clever. It is explained by the host and the hint; this is the design risk I would watch first.
- **Five levels, no progression beyond them.** The third game is a vertical slice by design. Do not build fifty.
- **Audio is synthesised and plain.** No music. Not reviewed by anyone with an ear for it.
- **Nothing is deployed.** The live site still shows the build from before M2.

## Engineering handover

- **Add or change a level:** edit `levels.ts` (bump `version`), run `npx tsx tools/dpt-solve.ts` (regenerates `solutions.ts`; level 5 takes about 8 s), run `npm test`. A level with no solution, a soft-lock or a stale solution fails a test. `npx tsx tools/dpt-lab.ts` prints what a naive player and the search do on each level.
- **Add a host line:** add to a pool in `lines.ts` (three tones, at least two lines each, under 100 characters; tests check length, count and a block-list). Add a new trigger by emitting a `HostInput` in `controller.ts` and handling it in `host.ts`.
- **Add a prediction:** add its rule to `derivePredictions` in `predictions.ts`. A prediction must be decided only by recorded events; the "never changes once given" test covers every level's recorded solution.
- **The debug hook** `window.__DPT__` (`state()`, `feed(inputs)`, `sfx()`) exists in every build, like `__HVA__`. `feed` replaces live input with a list (one per tick; bit 8 restarts the attempt) so tests can play the real loop deterministically. It reads state and injects inputs a player already has; it writes nothing.
- **Why no shared engine with The Experiment:** its grid and action model share nothing with a 60 Hz platformer. Keeping them apart is why adding this game changed no line of the Experiment.
- **Where to look if it feels wrong:** movement constants at the top of `sim.ts` (one place); beam timing is `BEAM` in `sim.ts`; respawn is `RESPAWN_TICKS` (250 ms).

## Deployment

Owner-run, unchanged: Actions > Deploy to GitHub Pages > Run workflow, branch `claude/humans-vs-ai-plan-fz5yq0`. Before the playtest link goes out: `npm run live-smoke -- https://rajat4493.github.io/HumVAi/` (now includes DON'T PRESS THAT) and your own 15 minutes above. To roll back, re-run the earlier deploy.

## Ambiguities in the brief, and what I decided

| Brief said | I read it as | Why, and what would change it |
|---|---|---|
| "Use the existing React/Vite/Phaser architecture where practical" | React and Vite yes; **Phaser no**: a pure simulation drawn to a 2D canvas | The game needs no scene graph or physics engine; a pure simulation is what makes "deterministic traps", "reachability" and "prediction integrity" testable in milliseconds, and it keeps 332 KB of Phaser out of this game. Reverse if a later level needs Phaser's particles or tilemap tools |
| "Locally record structured events" | Record them into the existing **consent-gated** local log (off by default), plus the game's own progress in its own save | Recording behaviour without opt-in would break the suite's privacy rule; the owner can change the rule, not me |
| "Three optional personality settings ... and a mute option" | Three tones that change how often and how sharply he speaks; mute is separate and hides all lines but not his face or the score | Keeps the muted game testable as "the game with no commentary" |
| "Mobile touch controls" | Four on-screen buttons under the level, shown on touch screens and narrow windows | Swipe or tap-to-jump zones would be less precise for a precision platformer |
| "Voluntary player enjoyment/fairness feedback" | Two optional taps after each level (felt fair / unfair, fun / meh), local only, never blocking | Free text is refused by the schema on purpose |
| "A satisfying finale where the player defeats the host" | Pressing the button ends the host (he shuts down, the ending names his accuracy); it is the only level that cannot be skipped | Defeating him must be earned |
| "Do not infer psychological states from behavior" | No "frustration", "engagement" or "rage" field exists anywhere; the host's composure is about his predictions, not about the player | Enforced by the schema vocabulary |
| The five level briefs | Followed as creative objectives; improved where the first design failed: level 1's button moved to a ledge (a button on the path was pressed by everyone), level 5's beam changed from "lock when you move" to "track, then lock" so the wall trick is learnable | Playtest will say whether more should change |

## Scope control

Refused, on purpose: more than five levels, any backend, accounts, leaderboards, payments, an AI model for the host, a level editor, key remapping, shareable video clips, daily challenges, and any change to The Experiment or Pattern Hunter. The one addition not asked for is a **skip** after 14 deaths on levels 1 to 4, because "not exhaustion or helplessness" was a stated goal and a stuck player has no other exit. It is easy to remove.

## Learning capture (TheDuck)

1. **A search player is a design tool, not only a test.** It told me, within seconds, when a level was impossible (level 5's first geometry), when a "trap" was trivial (level 1's hold-right player passed), and when the intended solution was not the only one. Ask the machine to play before asking a human.
2. **When the solver fails, the design may still be fine.** Level 5 stumped the search for an hour; scripted probes showed the level was winnable and the search was lost in timing states. The fix was a smaller move set for the search, not a redesign. Distinguish "unsolvable" from "unsearchable" before changing a level.
3. **Make the host's honesty checkable.** Predictions defined as a rule over recorded events turned "the AI seems smart" into numbers that can be tested and shown, and the funniest moments are the ones where the count says he was wrong.
4. **Test the test.** The soft-lock scan found nothing at first, which is also what a broken scan does. A deliberately broken level proved it can see.
5. **A caching bug can hide in a test helper.** Parsed levels were cached by id, so a test's throwaway levels all shared one grid and a loop spun forever. Cache by object, not by name.
6. **Frame-short input is a real bug.** A key pressed and released between two ticks was lost until inputs were latched for one tick. Browser tests that press keys quickly found it; the unit tests could not.
7. **Resist the extra level.** The brief and the evidence both say: five levels, a test with strangers, then decide. The pull to add content before knowing whether the loop works is the main risk to this project.

## Explicit non-claims

Not claimed: that the game is fun, fair, funny, shareable or ready for release; that the host improves enjoyment; that any AI model is involved (none is); that screen-reader users can play it; that it works on any browser not listed in the ledger or on any physical device.
