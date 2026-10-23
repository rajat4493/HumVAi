# DON'T PRESS THAT: external playtest plan (10 to 15 players)

**Status: not run.** Nothing in this repository claims the game is fun, fair or shareable. This plan is how we find out, and what result would make us change the design instead of adding levels.

Hard rule from the brief: *if the AI host is not improving enjoyment, revise or remove the feature rather than adding more dialogue.* The test is built around that sentence.

## Who and how

- **12 players minimum (10 to 15), not friends of the team, not developers.** Mix: about half who play platformers sometimes (a mobile phone or a console), half who rarely do. Record only: device (phone / laptop), and "platformers: often / sometimes / rarely".
- **Two groups of equal size, assigned alternately as they arrive** (1st: host on, 2nd: host muted, and so on):
  - Group A, host on: send `https://rajat4493.github.io/HumVAi/#/dont-press-that?host=on`
  - Group B, host muted: send `https://rajat4493.github.io/HumVAi/#/dont-press-that?host=muted`
  The link only presets the host's setting. The levels are identical.
- **Session: 20 minutes, unmoderated or observed, one sitting.** Tell them only: "Play until you want to stop. You can stop at any time." Do not explain the rules, the host or the controls beyond what is on screen.
- Do **not** ask them to opt in to data collection in the arcade settings (it is optional and off by default). Collect with the two methods below.

## What we collect, and from where

1. **Their own numbers, pasted by them.** On the level list, a *Copy my results* button copies numbers only: per level cleared/skipped, attempts, deaths, hints, how many levels they marked fair/unfair and fun/meh, the host's score, and whether they finished. The player pastes it into the response form. Nothing is uploaded by the game.
2. **Five questions** (form, same for both groups), each 1 to 5 unless noted:
   1. "Did the deaths feel fair?" (1 = never, 5 = always)
   2. "How much did you enjoy it?"
   3. "How much did you want to try again after dying?"
   4. "Would you challenge a friend to beat it?" (yes / maybe / no) and "Would you send a clip?" (yes / maybe / no)
   5. Group A only: "What did the host add?" (free text: funnier / annoying / neutral / distracting / something else)
3. **If you observe:** note the level and the moment of any "I give up", any laugh, and any "that's not fair".

If a player has opted in to the arcade's local data log and is happy to send the file, the neutral export (`humans-vs-ai-my-events.json`) adds exact death locations, retry times and the host's prediction record. It is optional.

## Measures, with the thresholds that decide what we do

All thresholds are **proposals set before the test**, so the outcome cannot be argued afterwards. With 12 players, treat differences as direction, not proof.

| Measure | How | Go | Revise | Stop or rethink |
|---|---|---|---|---|
| **Voluntary retries** | Mean deaths per level before clear (from the pasted summary); attempts after the first death | Most players retry at least 5 times on at least 3 levels | Many leave a level within 3 deaths | A majority quit on level 1 or 2 |
| **Perceived fairness** | Question 1; "felt unfair" taps | Median 4 or more; fewer than 1 in 5 level taps "unfair" | Median 3 | Median 2 or less, or one level with most "unfair" taps (find the death location) |
| **Enjoyment** | Question 2 | Median 4 or more | Median 3 | Median 2 or less |
| **Completion** | Finished all five (the `finished` flag) | 60 percent or more | 30 to 60 percent | under 30 percent |
| **Sharing** | Question 4 | At least 4 of 12 say yes to challenging a friend | 2 to 3 | 0 to 1 |
| **The host** | Group A vs Group B on enjoyment and on "want to try again" | Group A at least 0.5 higher on either measure, or free text says "funnier" more than "annoying" | No difference | Group A lower, or "annoying/distracting" outnumber "funnier" |

## Decisions the results trigger

- **Host Go:** keep him, and only then consider more lines, personalities or reactions.
- **Host no difference:** the levels are carrying the game. Keep him small; spend the effort on level design and on the next five levels, not on dialogue.
- **Host worse (or mostly "annoying"):** cut his speech to the moments players rated best (the prediction verdicts and the finale), or remove it and keep the visual rival.
- **Fairness problem on a level:** use the death locations from the exported events to find the trap players misread, then change that trap (change version, regenerate solutions with `tools/dpt-solve.ts`).
- **No retries:** the loop is wrong; do not add content until respawn, level length and trap readability are fixed.

## What must be true before sending the link

- The build on GitHub Pages is the commit named in `HANDOVER.md`, deployed by the owner.
- `npm run live-smoke -- <live url>` passes.
- The owner has personally played all five levels on a phone and on a laptop (see the handover list).
- A reminder for testers: the game has flashing-free visuals, screen shake can be turned off in the game settings, and "Reduce motion" in the arcade's Settings disables particles and shake.
