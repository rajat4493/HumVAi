# Experience review of the prototype (M0 corrections)

Method: I played all five worlds in a real browser (Chromium, desktop 1280×760 and a 390×780 touch viewport) through scripted and manual-equivalent input, looked at screenshots after every key moment, and watched the recorded playthroughs. **No human has played it.** Everything below is an expert inspection plus automated checks, not player evidence. Items marked *fixed* were found and fixed during this review.

Assets: `docs/design/screenshots/` (22 images: welcome, briefing, mid-play, scouting, run start, block on plate, jammed switch, rule change, result; desktop and mobile) and `docs/design/recordings/` (`desktop-playthrough.webm`, `mobile-playthrough.webm`, ~28 s each: world 1 win, world 2 scout → free experiment → Start run → world resets → win, world 3 push → drag → free reset).

## Verdict by question

| Question | Finding | Status |
|---|---|---|
| **Visual clarity** | The board reads at a glance: walkable floor vs raised walls (3.7:1), every object distinguishable by shape as well as colour (padlock door, circle/triangle/square/diamond switches, chevron plate, four-arrow block, rune). The Scout phase has its own look (blueprint grid, blue floor and frame) and the rule change has its own (violet). Remaining weaknesses: switch icons are small on a 7–12-column board; off-state switches are dim; the plate disappears under a block (the door's glow is the only signal). | Good; 3 minor issues open |
| **Touch controls** | 56 px pad buttons (asserted ≥ 44 px by test), thumb-reachable at the bottom, ACT/RUN/RESET labelled; swipe on the board moves. No horizontal scroll. Unverified: swipe gesture quality, haptics (not built), landscape phone. | Works; swipe untested |
| **Feedback after each action** | Step squash, bump nudge, push/drag slide, switch pulse, door pulse and glow, jam shake plus the text "Nothing happened", rune flash plus "The world just changed", reset fade, confetti on win. Gaps: no sound at all; a wall bump has no explanation beyond a nudge; plate press has only a texture swap; the budget bar changes but there is no "low budget" warning in Scout. | Visual feedback complete; audio missing |
| **Sense of progression** | Worlds are ordered, labelled "World N of 5", and Next world works. But there is no map, no stars/par, no saved progress (refresh loses it), no unlocks, and the Result screen is thin. Progression is *implied by difficulty*, not *rewarded*. | Weak (expected before M1) |
| **Enjoyment of experimentation** | The Scout phase is the strongest new idea: the board turns into a blueprint, resets are free, the pill says SCOUT, the toast says "The run begins. The world has reset; what you learned stays with you." That frames poking at a decoy switch as the point of the game rather than a waste. Not yet shown: whether players *want* to scout or just rush to the exit (auto-commit on finding the exit may feel abrupt). | Promising; needs players |
| **Does it feel like a game?** | It feels like a polished puzzle prototype: juicy movement, readable art, a clear loop (scout → run → result). It does **not** yet feel like Humans vs AI: the AI is a placeholder card, there is no sound, no stakes beyond a number, and the "contest" has one participant. | Partly |

## Defects found and fixed in this review
1. **Block drawn underneath the plate** when pushed onto it (Phaser containers draw in insertion order, not depth). Fixed with a depth sort; screenshot confirms.
2. **The rule change was nearly invisible** (a multiply tint on very dark floors). Replaced with dedicated violet floor textures plus a frame glow and a toast.
3. **Mobile HUD was cluttered**: title wrapped over three lines, budget dots overlapped it, and the Start-run button duplicated the pad's RUN. Rebuilt as a two-row HUD; large budgets (>14) use a bar with "20/24" instead of 24 dots.
4. **HUD pill drifted away from the budget on desktop** (a leftover max-width). Fixed.
5. **Result headline "Humanity scores." appeared although no AI had played.** Now "You made it out."
6. **Keyboard hints shown on touch devices.** Hidden on coarse pointers.
7. **Fast key presses were double counted** (found in the first M0 round; guarded by a test).

## Open issues (not fixed; need a decision or player data)
- No audio (specified in the design system, not built).
- Auto-commit when the exit is found in Scout: informative or deflating? Test with players.
- Result screen: scout and run counts shown, but no ghost replay, no "par".
- Progress is not saved.
- Large boards on small phones: the world 5 board (12 columns) renders at about 55 px/tile at 390 px width; fine for a taps-free grid, but small switch icons are hard to tell apart.
- Accessibility gaps from the design system (screen-reader board description, focus trap in dialogs) are unchanged.
- Real-device frame rate and battery are unmeasured.

## What a first playtest should answer
1. Do people discover the Scout button/idea unprompted, and do they use free reset?
2. Where do they stall in World 4 (jam) and World 5 (rune)?
3. Do they understand "the world has reset; what you learned stays with you"?
4. Is the drag mechanic discovered, or did they only push?
5. Do they miss sound? Do they want to see the AI immediately?
