# DON'T PRESS THAT: design

Status: playable five-level vertical slice, **not yet played by external players**. Everything below that says "feels" is a design intent, not a finding. Verification status for each claim is in `docs/VERIFICATION-LEDGER.md` (rows M3-*).

## Pillars

1. **Fair, then infuriating.** Every trap is deterministic and has one rule. The surprise is that you did not know the rule yet. No randomness, no hidden inputs, no fabricated near-misses.
2. **A rival, not a narrator.** The host reacts to specific things (you pressed the button; you jumped early; you waited) and makes claims that are checked.
3. **A quarter of a second.** Death to control in at most 15 ticks (250 ms), shorter if you press a key. No death cutscene can block a retry.
4. **Stands on its own with the host muted.** Levels are designed so the surprise is a puzzle you can solve silently.

## The rules of the world

One screen (20 x 11 tiles), fixed camera. 60 ticks per second, fixed step, no randomness. Pure, headless simulation in `sim.ts`; the screen only draws it.

| | |
|---|---|
| Run | 6.4 tiles/s, reached in about 70 ms; stops in about 60 ms |
| Jump | peak about 3.1 tiles held, about 1 tile for a tap; a running jump covers 4.2 to 5.2 tiles |
| Forgiveness | 6 ticks of coyote time (a jump just after leaving a ledge); 6 ticks of jump buffer (a press just before landing); hazard hitboxes smaller than the body |
| Gravity | 48 tiles/s squared, capped fall speed 24; a star flips it, and "jump" always means "away from the floor" |
| Respawn | 15 ticks (250 ms) maximum; a fresh key press after 6 ticks skips the rest; everything resets, every trap is armed again |

Controls: left, right, jump, restart (keyboard: arrows or A/D, Space, R; touch: four on-screen buttons). A press shorter than a tick still counts for one tick.

## The levels

Each level is a rule the player can discover, and a way to prove the host wrong.

1. **False Confidence.** A hallway. Spikes hang from the ceiling over the path. Walking past x = 10 springs them; they fall in 14 ticks, too fast to outrun. Rule: *the trap is sprung by you, once*. Two ways through: spring it on purpose, back off and jump the spikes that stay; or press the red button on the ledge, which springs it from far away. The button is labelled DON'T PRESS THAT. The host predicts you will press it (usually wrong) and walk into the spikes (usually right).
2. **The Prediction.** A three-tile gap, a ceiling with vents. Rule: *taking off from the ground before x = 8 springs spikes out of the vents over the gap.* The host predicts you will jump early. A late jump proves him wrong. His confidence quotes your own history ("1 of your 2 attempts did").
3. **The Betrayal.** A "helpful" star on the floor. Rule: *a star flips gravity; a second one flips it back.* The first star lets you cross the spike field on the ceiling (hop the hanging spikes); the second is inside a one-tile tunnel so it cannot be missed. The host predicts you will not survive five seconds after taking it.
4. **Mind Games.** Pits, spikes, and a beam. The beam *tracks* where it expects you (0.6 s), *locks* (0.4 s, the marker changes and stops), then fires. If you ran last attempt, it aims ahead of a runner; if you waited, it aims at your feet. Rule: *do the opposite of what it expects.* The host tells you which one it is using.
5. **Humiliate the AI.** Stars, spikes, a cracked wall, and the button. The beam always aims ahead. It does not know walls exist. Run at the wall, let it lock on, and slow down: it destroys its own wall. Then press the button. It was the off switch.

Level 4's beam is the one place the host "remembers" you. It remembers one number per attempt (the longest time you stood still), in memory only, and it is the same number in every browser.

## The host: Professor Probably

A floating glass orb with a monocle and a bow tie. Smug, theatrical, confidently wrong. He is a pure function of what happened, so he works offline and costs nothing.

- **Lines.** 216 authored lines across 36 triggers and three personalities (two or more lines per trigger per personality) (Playful, On Edge, Chaos). A trigger uses every line in its pool before repeating. Tone changes how often he speaks and how he sounds, never the level.
- **Predictions.** Each is a sentence plus a rule over recorded events. A verdict is `correct`, `wrong` or `void` (never got a fair test). Counts come from the entries and are shown on screen. Confidence numbers are only ever real counts of your own attempts ("1 of your 2 attempts did"); on the first attempt he says he has no data.
- **Composure.** A number from 0 to 100 that falls when he is wrong and when you clear a level, and rises when you die. It changes his face (cracks, sweat, stutter) and which mood his lines wear. It does not touch the physics.
- **Mute.** Hides every line; his face and the prediction counts remain. Hints are a separate, player-asked button.
- **Not abusive.** Lines tease the attempt ("that was statistically inconvenient"), never the player; a test scans for a block-list of insults.

## Not-frustrating by design

- Hint button after 6 deaths in a level; skip after 14 (levels 1 to 4; the finale cannot be skipped).
- The host softens as deaths mount ("Hint available whenever you want it"), and never mocks a streak beyond one line per stage.
- Optional two-tap feedback after each level (felt fair / unfair, fun / meh), local only.

## What is deliberately out of scope

More than five levels, a story, accounts, leaderboards, an AI model for the host, daily challenges, a level editor, replays you can share as clips (the "Challenge a friend" button shares a sentence and a link, nothing else).
