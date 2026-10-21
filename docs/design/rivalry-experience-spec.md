# Rivalry experience — UI/UX specification (Task 3; nothing here is implemented)

Goal: make Humans vs AI feel like a contest between two kinds of intelligence, while being scrupulously honest that the AI's side is a **recording** (until a live mode exists and is labelled as live). The AI is a respected opponent, never a villain and never a mascot pretending to think.

## 0. Honesty rules (non-negotiable, testable)

| # | Rule | How it is enforced |
|---|---|---|
| H1 | Every element derived from an AI attempt (avatar state, numbers, replay, notes, distribution) is inside a container with `data-source="recorded"` and shows the **RECORDED** badge (text + icon, never colour alone) somewhere within or directly attached to it. | e2e test walks every `data-source="recorded"` ancestor and asserts a visible `RECORDED` badge; lint test forbids rendering AI data outside such a container |
| H2 | The badge always carries: model display name, provider, recording date, and "attempt N of 10". A details panel adds configuration id, sample count, cost and latency. | component unit test on required props (build fails if missing) |
| H3 | Never imply real-time reasoning: no "thinking…", typing indicators, spinners tied to the AI, streaming text, blinking cursors, countdown-to-answer, or fake latency. The replay advances at a fixed cadence independent of recorded latency. | string/animation denylist test over replay components; e2e asserts replay step intervals are constant |
| H4 | The model's `note` is shown only as **"Self-reported note: written by the model during the attempt. It may not reflect how it actually decided."** | snapshot test of the note component |
| H5 | The AI's result is never shown before the human's run ends (no spoilers) and never altered after the fact. | e2e: before the human result, DOM contains no AI numbers |
| H6 | If a run is not replay-verified, it is not shown as a result; the UI shows the "inconclusive" state. | integration test with an unverified fixture |
| H7 | A future live mode must use the badge **LIVE** and show real latency; it cannot reuse the recorded visuals. | spec only (no live mode in M1/M2) |
| H8 | Reference/scripted opponents are labelled **"Reference solver (not an AI)"**. | fixture test |

## 1. AI opponent identity

- **Name:** "The AI" in the interface; the specific model is shown as a chip: `{displayName} · {provider}`. We name the participant by what it is, never give it a human name, face, voice or personality text.
- **Avatar:** the periwinkle rotated rounded diamond (existing token `--ai`), hovering gently (idle only on screens where nothing is being claimed about thought). The human is the amber round blob. Shape + colour + motion keep them distinct without hostility.
- **Tone of copy:** neutral and respectful. Outcomes are described as facts ("The AI reached the exit in 9 actions"), never taunts or praise in either direction.
- **States of the avatar:** `idle` (hover), `ready` (recorded attempt available: a small RECORDED badge appears), `replaying` (diamond slides along the board as the ghost, trailing a faint path), `solved` (soft ring pulse once), `unsolved` (stays still, ring dims), `unverified` (outline only, dashed). No state uses red.
- **Card content (side panel desktop / chip on mobile):** avatar, "The AI", model chip, one line of status. Pre-reveal the card says only "A recorded attempt is ready" (no numbers, no "solved/failed").
- **Budget parity line (already built):** `Scout 16 · Run 12` for both sides.

## 2. Screens and states

```
Arena (during human play)                Result reveal (after human run ends)
┌ World 2 of 5 ── SCOUT ━━━━━ [Start run] ┐   ┌ Result ───────────────────────────────────────────────┐
│ You card │     board      │ The AI card │   │  headline (outcome)                                    │
│ (live)   │                │ "A recorded │   │  ┌ You ──────────┐ vs ┌ The AI  [RECORDED …] ─────┐  │
│          │                │ attempt is  │   │  │ Run 9 / 12    │    │ Run 9 / 12 (attempt 5/10)  │  │
│          │                │ ready"      │   │  │ Scout 7 / 16  │    │ Scout 11 / 16              │  │
└──────────┴────────────────┴─────────────┘   │  └───────────────┘    └────────────────────────────┘  │
                                              │  across 10 recorded attempts: ●●●●○○ dot strip + you ▲ │
                                              │  [ Watch the AI's run ▶ ]  [ Play again ] [ Next ]     │
                                              └────────────────────────────────────────────────────────┘
```
Reveal sequence: (1) the human's own result settles (existing win/lose beat, 0.6 s), (2) a one-second "unveil" where the AI card flips from "ready" to its numbers with the RECORDED badge already visible, (3) the headline and comparison bars animate, (4) the primary action becomes "Watch the AI's run".

## 3. AI progress presentation

*During human play:* nothing about the AI's progress (H5). The AI card shows only that a recorded attempt exists and the shared budgets.

*After reveal:* **progress as a timeline of the attempt**, not a live bar. A horizontal strip with two segments, **Scout** (blue, length proportional to its actions) and **Run** (amber), one tick per action (ticks coloured by event type: move, bump, interact, no effect, reset, commit), with markers at: `COMMITTED`, `EPOCH_CHANGED`, `DOOR_OPENED`, `WON/LOST`. The human's own strip sits directly above it on the same scale so length and structure are comparable at a glance. Hovering/tapping a tick shows its action. Under each strip: "Scout 7 · Run 9". No percentages, no "AI is X% done".

## 4. Human vs AI score comparison

Headline comparison is **head-to-head against the shown attempt**, using the exact tuple rule from `docs/ai/experiment-spec.md` §12. Context is shown beneath it.

- **Rows:** Outcome (reached the exit / out of actions), Run actions, Scout actions. The better value per row is marked with a text label ("fewer") and an icon, not only colour.
- **Bars:** two horizontal bars on one scale (0…run budget), human amber, AI periwinkle, with a thin line at the optimal length labelled "shortest possible: 9" (optimal comes from the solver and is shown only after the reveal).
- **Distribution strip ("across 10 recorded attempts"):** ten dots on the same action scale, filled = reached the exit, hollow = did not; your result is a ▲ marker. Caption: "The AI reached the exit in 8 of 10 recorded attempts. Fastest 9, median 10." Always the real counts; with n=10 never a percentage without the count.
- **Shown attempt selection (published rule):** the attempt whose run length is the **median among successful attempts** (lower median if even; ties → lowest attempt number). If none succeeded: the attempt whose final position was nearest the exit by shortest-path distance (ties → lowest attempt number), labelled "unsuccessful". The rule is stated in the details panel. Never chosen after seeing the human's result.
- **Outcomes (five, mutually exclusive):** `HUMAN_AHEAD`, `AI_AHEAD`, `TIE`, `BOTH_FAILED`, `INCONCLUSIVE` (AI record missing/unverified/void).

Copy deck (neutral, short):

| Outcome | Headline | Sub-line |
|---|---|---|
| HUMAN_AHEAD | "You got there first." | "You: 9 actions. The AI's recorded attempt: 11." (if human won and AI failed: "The AI's recorded attempt did not reach the exit.") |
| AI_AHEAD | "The AI got there faster." | "The AI's recorded attempt: 8 actions. You: 11. Watch how it did it." |
| TIE | "Dead even." | "Both reached the exit in 9 actions with 7 Scout actions each." (or "…decided on Scout actions" never needed: equal on all) |
| BOTH_FAILED | "Neither made it out." | "Here is one way through." (offers the solver's solution as a ghost, labelled "Shortest solution (computed, not an AI)") |
| INCONCLUSIVE | "No fair comparison this time." | "We couldn't verify the AI's recorded attempt, so we're not scoring it." |

## 5. AI action replay ("Watch the AI's run")

- **Surface:** the same board, the AI as the diamond ghost on top of a dimmed copy of the world, in a modal-free panel; the RECORDED badge and model chip sit in the replay header at all times (H1/H2). A persistent line: "Recorded replay. This is not live."
- **Cadence (H3):** one action every **450 ms at 1×** (reduced motion: step on click), independent of the recorded latency. Speeds 0.5×, 1×, 2×, 4×, and **Skip Scout** (jump to COMMIT) / **Skip to Run**. Pause, step back, step forward, scrub on the timeline strip.
- **Phases:** the replay reproduces the engine's real phases: Scout (blueprint look, SCOUT pill), the COMMITTED reset (the same toast and fade as in play), then the Run. Scout and Run counters tick exactly as recorded.
- **Event captions:** one line under the board per action in plain words ("Moved right", "Tried the triangle switch: nothing happened", "Dragged the block", "The world changed"). Generated from engine events, not from the model.
- **Notes:** if the model wrote a `note` for that step, it appears as a small card beside the board with the H4 label. Notes never animate in character-by-character.
- **Side-by-side "Race view" (desktop; tab on mobile):** human replay of the player's own run and the AI replay on two boards synchronised by *action index*; a small "step 6 / 6" counter shows equal progress, so the viewer sees who needed fewer actions. Labels: "You (your run)" and "The AI (RECORDED)".
- **Details panel (collapsed):** model identity, configuration id, sampling settings, attempt id, number of recorded attempts, call counts, tokens, cost and latency ("measured while recording; not shown in replay"), how the shown attempt was chosen, replay-verified ✓ with the date.
- **Errors:** record missing → "No recorded attempt for this world yet." Verification failed → INCONCLUSIVE state. Replay desync (should never happen) → stop and show the verification error.

## 6. Victory, defeat and tie animations

All use existing tokens; durations are targets; reduced-motion alternative in the last column. The human's own win/loss beat in the arena (confetti burst, shake) is unchanged; these are the **reveal** animations.

| Outcome | Sequence | Duration | Reduced motion |
|---|---|---|---|
| HUMAN_AHEAD ("victory") | Board dims to 60%. Human badge swells 1.0→1.25 with an amber ring pulse; amber confetti rises (36 particles, as in-arena but upward); the human bar fills first, then the AI bar; the headline types **in as a whole** (fade, not typewriter). The AI avatar eases to a calm "solved/unsolved" ring and nods slightly (2 px). No mockery: the AI avatar does not shrink or turn red. | 1.8 s | Crossfade headline and bars; no particles |
| AI_AHEAD ("defeat") | Board dims. AI diamond rises 8 px and emits one periwinkle ring pulse (the AI "has the floor"); the AI bar fills first, then yours; the human badge stays steady (no shake, no red). The primary action becomes "Watch how" with the diamond pointing at it. Tone: respect and curiosity, an invitation to learn. | 1.6 s | Crossfade; ring becomes a static outline |
| TIE | Both badges slide toward the centre and overlap; their glows blend amber+periwinkle into violet (`--discovery`); the two bars meet at the same length with a bracket "equal". Headline fades in. | 1.4 s | Static overlap, instant |
| BOTH_FAILED | Board shows the computed shortest path as a thin trail (labelled "Shortest solution (computed)"); both badges dim equally. | 1.2 s | Trail appears without drawing animation |
| INCONCLUSIVE | AI card turns outline-only (dashed), neutral grey; no bars for the AI. | 0.6 s | Instant |

## 7. Audio feedback

Principles: audio reinforces, never carries information alone (every cue has a visual twin); off until a user gesture; one master mute plus volume in Settings, persisted; master level −12 dBFS, peaks ≤ −6 dBFS; no speech, no voices, no music beds in M1; the AI never has a "voice". The human side is warm (triangle/sine, low-mid), the AI side is glassy (sine + FM partial, mid-high), so a listener can tell whose action it is in the replay. Implementation by Web Audio synthesis (no asset files in M1; file size and licensing zero).

| Cue id | Trigger | Sound (synthesised) | Dur | Gain |
|---|---|---|---|---|
| `step` | human move | triangle 220 Hz, 8 ms attack, 70 ms decay | 90 ms | −24 dB |
| `bump` | blocked | sine 110 Hz thud + 10% noise burst | 80 ms | −20 dB |
| `push` | push/drag | filtered noise sweep 400→200 Hz + `bump` thunk | 140 ms | −20 dB |
| `switch_on / off` | toggle | two sines, up (330→494 Hz) / down (494→330 Hz) | 120 ms | −20 dB |
| `no_effect` | jam | muted two-tick 180 Hz, **no** error buzz | 100 ms | −26 dB |
| `door_open / close` | door | wooden slide: noise 800→300 Hz / latch tick | 200 ms / 60 ms | −22 dB |
| `plate_down / up` | plate | low press 140 Hz / release 190 Hz | 80 ms | −22 dB |
| `shift` | rule change | rising shimmer 400→1200 Hz sines then 300 ms silence | 700 ms | −18 dB |
| `commit` | Scout→Run | soft "reset" swoosh down 600→200 Hz, then a clean 523 Hz tap | 350 ms | −18 dB |
| `win` (arena) | exit in run | ascending triad C5–E5–G5, triangle | 450 ms | −14 dB |
| `loss` (arena) | out of actions | descending two notes G4–D4, sine, gentle | 400 ms | −18 dB |
| `ai_step` | replay tick | sine 523 Hz + 2:1 FM, bell-like, very short | 60 ms | −30 dB (quieter than human cues so replay is not loud) |
| `reveal_human` | HUMAN_AHEAD | warm major chord C-E-G swell | 900 ms | −14 dB |
| `reveal_ai` | AI_AHEAD | glassy fifth D-A with soft shimmer | 900 ms | −14 dB |
| `reveal_tie` | TIE | both timbres sounding the same unison note, then converging | 900 ms | −14 dB |
| `reveal_none` | BOTH_FAILED/INCONCLUSIVE | single soft tap | 150 ms | −22 dB |

Accessibility: captions are the on-screen text already specified; `prefers-reduced-motion` does not mute audio, but a separate "Sound" toggle is first-run visible; sounds never exceed ~1 s; no flashing/pulsing faster than 3 Hz.

## 8. Responsive layout

- **Desktop (≥ 761 px):** reveal card centred over the dimmed board; comparison as two columns (You | The AI); replay as a wide panel with timeline below the board; Race view available.
- **Mobile:** reveal is a full-width bottom sheet: headline, compact two-row comparison, the dot strip, then three large buttons (≥ 56 px): Watch the AI's run, Play again, Next. Replay is full-screen with transport controls at the bottom, Race view as a swipeable tab. RECORDED badge stays pinned at the top of the replay screen.

## 9. Data the UI needs (from the M1 schemas)
`RunRecord` for the human run; for the AI: the selected attempt's `RunRecord` + `summary {attemptsTotal, attemptsWon, medianRun, fastestRun}`, model identity, config id, recording date, verification status/date, optimal length for the world. If any required field is missing the UI must fall back to INCONCLUSIVE and never fabricate a value.

## 10. Acceptance criteria for this spec when built
1. H1–H8 each have an automated test that fails if violated.
2. The five outcomes render correctly from fixtures covering every branch of the head-to-head rule, including equal-run/different-scout and equal-on-all.
3. Replay of a fixture record reproduces the engine's recorded events exactly (golden test) at constant cadence; pausing/stepping never desynchronises the board from the counters.
4. Reduced-motion mode shows no particle, flash, or slide animation and every outcome remains understandable.
5. Audio: every cue plays once per trigger, respects mute, and is silent before the first user gesture.
6. Mobile 390×780: no horizontal scroll, all controls ≥ 44 px (primary ≥ 56 px), RECORDED badge visible without scrolling.
7. A no-AI-data state (fresh install with no recordings) shows "No recorded AI attempt yet" and no AI numbers.

## 11. Open design questions (for approval)
1. Is the AI's result hidden until the human finishes (proposed yes), or shown as a pre-game "to beat" target? (Spoilers vs stakes.)
2. Show the per-attempt `note`s at all (proposed yes, labelled), given they may mislead?
3. Is "Dead even." too flippant for a tie? Alternative: "A tie."
4. Should the shortest-solution trail on BOTH_FAILED be offered, or is it too much help for a world the player may retry?
