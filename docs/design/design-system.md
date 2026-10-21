# Playful Futurism — Design System v0 (M0)

Initial tokens, not a finalized brand. Source of truth in code: `apps/web/src/styles/tokens.css` (CSS) and `apps/web/src/game/theme.ts` (Phaser, hex ints). Keep the two in sync.

Target feel: **miniature interactive worlds** — soft depth, strong colour identity, readable geometry. Not cyberpunk, not a SaaS dashboard, not a children's mobile game.

## 1. Colour tokens

| Token | Hex | Use |
|---|---|---|
| `--midnight` | `#0b1026` | App background, deepest surface |
| `--midnight-2` | `#121a3d` | Background gradient top, cards |
| `--canvas` / `--canvas-2` | `#1b2552` / `#222d62` | Panels, inactive pips |
| `--ink` / `--ink-dim` | `#f4f1ff` / `#a9b0d6` | Primary / secondary text |
| `--human` | `#ffb347` (deep `#e07b1a`) | The human: warm, round, glowing |
| `--ai` | `#6f8cff` (deep `#4a5fe0`) | The AI: cool, angular, hovering |
| `--discovery` | `#b78cff` | Things you can act on / new knowledge (blocks, tripwire runes, focus ring) |
| `--exit` | `#5be38a` | Goal, success, pressed plate |
| `--warn` | `#ff6b6b` | Low budget, loss |
| Switch accents | orange `#ff7a45`, teal `#2dd4bf`, yellow `#f5d547`, sky `#5fd0ff` | Per-switch identity (always paired with a shape) |

Neither side is good or evil: human = warm/round, AI = cool/angular, both are rendered with the same glow, weight and respect. **Do not** use `--warn` for the AI.

Measured contrast (WCAG relative luminance, computed in M0): ink on midnight 16.9:1 · ink-dim on midnight-2 7.9:1 · ink-dim on card 6.1:1 · button text on human 10.2:1 · human on midnight 10.6:1 · AI on midnight 6.2:1 · warn on card 4.7:1 · **wall-top vs floor 3.7:1** (raised from 1.67:1 after a first review failed the 3:1 non-text guideline) · human vs floor 7.5:1 · exit vs floor 5.4:1.

## 2. Typography

Rounded display face for titles/numbers; neutral system sans for body. **No web-font download** (keeps first load fast; avoids layout shift).

- Display: `ui-rounded, 'SF Pro Rounded', 'Nunito', 'Avenir Next Rounded', 'Segoe UI Variable Display', system-ui` — 800 for logo, 700 for buttons/headings.
- Body: `system-ui, -apple-system, 'Segoe UI', Roboto`.
- Scale: logo `clamp(2.4rem, 8vw, 5rem)`, screen title `1.25–1.9rem`, body `1rem`, kicker `0.75rem` uppercase 0.14em tracking.
- In-game text is minimal: level name, budget pips, one-line actor roles. No explanatory paragraphs during play.

## 3. Game-board visual language

- **Depth:** objects sit on a flat floor with a soft contact shadow; walls are raised blocks (lighter top face, darker side face, 14 px overhang onto the tile below). One light direction: top-left.
- **Floor:** two alternating dark navy tones (checker) so movement distance is countable; rounded inset tiles.
- **Readable by shape, not colour alone** (hard rule):

| Object | Shape/icon | Colour | States |
|---|---|---|---|
| Player (human) | Round blob with eyes | amber | — |
| Exit | Ring + star, slowly rotating | green | — |
| Wall | Raised rounded block | periwinkle | — |
| Door | Wooden panel + **padlock** → open frame | brown / green glow | closed, open |
| Switch | Plinth + **circle / square / triangle / diamond** button | per-switch accent | off (dim), on (bright + glow + highlight) |
| Plate | Recessed square + **down chevron** | grey → green | idle, pressed (sunk 2 px) |
| Block | Rounded cube + **four-way arrow** | violet | static (moves when pushed) |
| Tripwire | Dashed ring + diamond (rune) | violet → grey | armed (pulses), spent |
| AI | Rotated rounded diamond, gently hovering | periwinkle | (M2: appears as a ghost run) |

- **Scout phase** (added in the M0 review): blueprint-blue floor textures, faint grid and blue glow on the frame, SCOUT pill and blue budget dots/bar. **Run phase:** the normal navy floor, amber RUN pill and amber dots.
- **Epoch change** (world rules changed): camera flash, violet floor textures, violet frame glow and the toast "The world just changed". Cue only; never explains the new rule.
- **Budget display:** dots up to 14, a bar with a number above that.
- The board takes the largest area the screen allows (desktop: centre column; mobile: full width above controls). Scale = `min(w/mapW, h/mapH)` with 4% padding.

## 4. Human and AI identities

| | Human | AI |
|---|---|---|
| Shape | circle | rotated rounded square (diamond) |
| Colour | amber | periwinkle |
| Motion | squash-and-stretch steps | slow hover |
| Voice (UI copy) | "You. Exploring." | "The AI. Plays the same world on its own." |
| Win line | "Humanity scores." | (M2) "The AI got there in N." |

Result screens must support three outcomes: human ahead, AI ahead, and **tie/inconclusive** (not built in M0).

## 5. Animation principles

1. **Animations explain cause and effect.** Every state change has a motion: step → squash; push → slide; switch → pulse; door → pulse + glow; jam → shake; shift → flash.
2. **Fast and snappy:** 70–160 ms for action feedback, ≤400 ms for overlays. Never block input on an animation — the visuals always snap to the true state (`sync()` is idempotent).
3. **Failure is quiet, victory is loud:** bump = 9 px nudge, win = 36-particle burst + pulse.
4. **Reduced motion** (`prefers-reduced-motion`): tweens collapse to instant moves, no loops, no particles, no flash; CSS durations become 0.
5. Easing: `Quad.out` for movement, `Back.out` for squash recovery, `cubic-bezier(.2,.9,.25,1)` in CSS.

## 6. Layout specifications

**Desktop (≥ 761 px, landscape):** 3-column grid `240 | board | 240`. Top HUD row: world kicker + level name (left), budget pips (right). Left card: Human; right card: AI. Board is a rounded glass frame with a transparent Phaser canvas inside.

**Mobile (≤ 760 px or portrait ≤ 1000 px):** single column — HUD, board (flex), two compact actor chips side by side, then a thumb-reachable D-pad (56 px targets, centre INTERACT, RESET bottom-right). Swipe on the board also moves. Safe-area padding at the bottom. No horizontal scroll (e2e-tested).

**Touch from day one:** D-pad, swipe, ≥56 px controls. Hover is never required.

## 7. Sound and interaction feedback (specification — **not implemented in M0**)

| Event | Sound | Haptic (mobile) | Visual |
|---|---|---|---|
| Step | soft low tick, pitch rises with distance to exit (optional) | none | squash |
| Bump | dull thud | 10 ms | nudge |
| Push | scrape + thunk | 15 ms | slide |
| Switch on/off | two-tone click up/down | 10 ms | pulse |
| Jammed (no effect) | muted "tk-tk", **no** error buzz | 2×8 ms | shake |
| Door open/close | wooden slide / latch | none | glow |
| Plate press/release | low press / release | none | sink |
| Rule shift | rising shimmer, then silence | 30 ms | flash + tint |
| Win | 3-note ascending chime | 40 ms | burst |
| Loss | descending 2-note, gentle | none | tiny shake |

Rules: all audio off until first user gesture (autoplay policy), a mute toggle in Settings, no sound is the *only* carrier of information, volume defaults low.

## 8. Accessibility status

| Item | M0 status |
|---|---|
| Keyboard play (arrows/WASD, Space, R) | ✅ implemented and e2e-tested; key-repeat ignored |
| Reduced motion | ✅ implemented (tweens, loops, particles, flash, CSS) |
| Shape+colour redundancy | ✅ all gameplay objects |
| Text contrast | ✅ measured above |
| Focus ring | ✅ visible (`--discovery`) on buttons |
| Dialog semantics | ✅ `role=dialog`, labelled; ⚠ no focus trap yet |
| Screen-reader description of the board | ❌ not built (needs a live text description of `PublicGameState`; the ASCII renderer is a starting point) |
| High-contrast mode, colour-blind audit with simulation | ❌ not done |
| Sound / captions | ❌ not built |

## 9. Reusable asset inventory (all procedural, generated once at boot)

`floorA/B, wall, exit, human, block, plate-{idle,pressed}, door-{closed,open}, <switch-id>-{on,off} ×7, tripwire-{armed,spent}, spark`. No external image files; art direction can be swapped by replacing `textures.ts` without touching rules.
