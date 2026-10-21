# Stage 0 — baseline and reconciliation with the Master Production Prompt v1.0

Purpose: before building, confirm the new mandate does not contradict what is already built, decided or approved. No product code was changed for this document.

## 1. Independently established baseline (clean install, 2026-10-21)

| Check | Result |
|---|---|
| Remote vs local | `origin/claude/humans-vs-ai-plan-fz5yq0` = local HEAD = `3e22c1a` (matches the prompt's reference commit; nothing newer) |
| `npm ci` | exit 0 |
| `npm run check` (typecheck, lint, tests, level verification, build, bundle key scan) | exit 0 |
| Unit tests | **101 / 101 pass** (matches the handover) |
| Browser tests (desktop + touch) | **14 pass, 2 intentionally skipped** |
| Level verification | 5 / 5 PASS: solvable, 0 dead states, replay-verified, World 5 rule change provably essential |
| Bundle | Phaser 332 KB gz (own chunk), app 71 KB gz, CSS 3 KB gz; scan finds no keys or provider hosts |
| Repository | 121 tracked files, ~4,400 lines of TypeScript (excluding docs) |
| Real AI access | `ANTHROPIC_API_KEY` not set; `OPENAI_API_KEY` not set; `api.openai.com` blocked by the network policy; `api.anthropic.com` reachable (401 without a key) |
| Browsers available for testing | Chromium only |

## 2. Inventory against the mandate

| Mandate item | State |
|---|---|
| Deterministic engine, 5 solvable levels, Scout/Run, push/drag, conditional rules, rule change | **Built and verified** |
| Keyboard and touch controls; Welcome, Briefing, Arena, Result | **Built** (review build: Next-world button instead of a map) |
| AI runner, Anthropic + OpenAI adapters, schemas, logging, replay verification, spend caps | **Built; verified against mock providers only** |
| Real AI results, costs, latencies | **Blocked** (no keys, OpenAI host blocked, no approved cap) |
| World map, chapters, save/resume, personal bests, settings | Not built |
| Audio (effects, music), mute/volume | Not built (specified only) |
| Hints, achievements, daily challenge, share cards | Not built |
| Rivalry UI (reveal, comparison, replay, outcomes) | Not built (specified only) |
| 20-level campaign | 5 of 20 exist; chapter metadata does not exist |
| Deployment, live URL | Not done; no host or credentials chosen |
| Human playtests, other browsers, real devices | Not done; not possible from this environment without the owner |

## 3. Contradiction and tension register

Severity: **A** = direct contradiction, needs a decision; **B** = tension, resolved by a default I propose; **C** = consistent, noted for clarity.

| # | Sev | Mandate says | What exists / was decided | Proposed resolution |
|---|---|---|---|---|
| C1 | **A** | Human = **cyan/blue**; AI = **amber/coral**; gold for discovery | Built, documented and owner-approved ("retain visual direction provisionally"): human = **amber** `#ffb347`, AI = **periwinkle** `#6f8cff`, discovery violet, exit green. The mandate inverts the two sides. Practical clash if swapped: AI coral/amber collides with the **orange switch** (a gameplay colour) and the warning red | **Keep the built palette** (warm human, cool AI) unless you insist. If you do, I recolour sprites/tokens/docs/screenshots and move the orange switch to another hue (about half a day) |
| C2 | **A** | Finding the exit while scouting must **not** auto-start the run; the player explicitly commits | Built: exit found in Scout auto-commits (an open decision I flagged; your M1 text also said not to change Scout/Run without evidence) | **Treat the new text as your decision and implement it**: reaching the exit in Scout does nothing but show an "exit found" cue; the player presses Start run. Spending the whole Scout budget still ends scouting. Ripple: engine rule + 4 tests, the AI system prompt text (prompt hash and version change), level plans in tests/e2e, docs |
| C3 | B | Build the rivalry UI now; integrate real recordings "when available"; reference solvers allowed if labelled | M1 authorization said build Gate 3 only after the runner is verified with a real model | Build the rivalry UI now against fixtures labelled "Reference solver (not an AI)"; switch to real records when they exist; never mix |
| C4 | **A** (cannot be met yet) | Every reveal shows a **real, verified** AI result; DoD #6 requires verified results | No real run exists; blocked by keys, OpenAI network access, model id, prices and a spend cap | Reveal shows a real recording if one exists, otherwise an explicit "no recorded AI attempt for this world yet". No filler, ever. DoD #6 stays unmet until credentials arrive |
| C5 | B | Daily challenge from deterministic, versioned content, plus honest AI comparison | No generator; variants unvalidated for fun; AI recordings per day are unaffordable and unavailable | Daily = curated, solver-validated rotation of authored variants; AI comparison shown only where a recording exists, otherwise labelled "no AI comparison today". Depends on the variant validator (feasibility measured, fun not) |
| C6 | **A** | Hall of Humanity showing only verified achievements; avoid leaderboards and identity records; no accounts; server-authoritative competitive verification | No backend, accounts, consent or anti-cheat | v1.0 Hall = **local only** (your own verified achievements on your device). A public Hall needs a backend, consent and anti-cheat, so it is deferred unless you say otherwise |
| C7 | B | Backend "only where necessary" (secure model calls, verification, serving recordings, abuse/spend controls) | None exists; recordings are small JSON | **Static-first**: verified recordings ship as static files checked by the verifier in CI; no live model calls from the browser, no public submissions in v1.0, so no backend, no secrets, no spend-abuse surface. Add one only if you want live AI or public results |
| C8 | B | Subtle background music | M1 plan excluded music | Allowed now. Original, procedurally synthesised with Web Audio (no licensed assets); provenance documented; mute/volume persisted |
| C9 | **A** (escalation) | Deploy a production URL; GitHub holds release source | No host or deploy permission; the container is ephemeral | Need your choice of host (GitHub Pages, Cloudflare Pages, Netlify or Vercel) and the access grant. Until then the deliverable is a static build plus the GitHub source |
| C10 | **A** (cannot be met by me alone) | DoD: real users tested, major browsers, real-device performance | Only headless Chromium here; no devices; no participants | I do everything possible (Chromium desktop and touch emulation, automated a11y, performance traces) and mark the rest "owner-assisted, not verified". The game will not be called production-ready without them |
| C11 | B | Stage 2 (AI validation) before Stage 3 (campaign); my earlier plan froze new worlds until the AI report | Stage 2 is blocked by credentials, which would block Stage 3 indefinitely | **Proceed with Stage 3 authoring while Stage 2 waits**, because every level is solver-verified and tuning is a later pass; accept the known risk that worlds may need retuning once real AI data exists (audit G1). Needs your OK |
| C12 | B | Chapter 4 "Adaptation" covers changing environments; the first five-level experience is the quality benchmark | Existing World 5 (rule change) is an Adaptation level, World 3/4 are Chapter 2 mechanics | Level ids stay stable (`w01…w05`); chapter placement becomes metadata in a campaign table. The Stage 1 five-level slice plays W1–W5 in order as the benchmark; the final campaign places W5 in Chapter 4 with new levels around it. Existing levels are refined, not replaced |
| C13 | B | Optional hints and recovery; AI gets the same information | AI gets no hints | Hints are marked on the result ("with hint") and a hinted run is not compared as a clean head-to-head; hint use is recorded |
| C14 | B | AI reveal "tension during the human attempt without misleading AI activity" | Spec rule H5: no AI information until the human finishes | Tension comes from the human's own budget, phase and a neutral "a recorded attempt is waiting" card; no AI progress is ever shown during play |
| C15 | C | Loop includes "Verify" | Engine replay verifies the human run locally; no server | Consistent: local verification; no public scores, so nothing client-submitted is trusted |
| C16 | C | Preserve engine, levels, tests, evidence; no rebuild | All preserved | Consistent. Changes to the engine are limited to C2 and recorded with tests |
| C17 | C | Validate model identifiers against the provider; secrets server-side; no handicaps; spend cap | Implemented as preflight, key isolation, bundle scan, caps | Consistent |
| C18 | C | "Never present prerecorded as live"; labels on AI elements | Spec H1–H8 | Consistent; those rules become the acceptance tests |

## 4. Escalations (what I need from you; everything else I proceed on)

1. **C1** colour direction: keep amber-human/periwinkle-AI (recommended) or invert per the mandate.
2. **C2** confirmation that explicit commit overrides the earlier "do not change Scout/Run without evidence".
3. **C6** local-only Hall of Humanity for v1.0 (recommended) or a public one (needs backend, consent, anti-cheat).
4. **C11** permission to author levels before real AI data exists.
5. **C9** deployment host and access grant.
6. **C4** for real AI: keys as environment secrets, `api.openai.com` allowed, the OpenAI model id, prices, and a spend cap.
7. **C10** who will run playtests and real-device checks.

## 5. Prioritised backlog once the register is confirmed (not a new plan, just the order)

**P0, Stage 1 (unblocked):** explicit commit (C2) · campaign metadata and chapter table · local save/resume, personal bests, settings · world map · audio engine, effects and music · rivalry UI on labelled fixtures with the pure head-to-head rule · replay ghost · outcome animations · hint system with parity marking · mobile and art polish of the five-level slice · accessibility pass (focus trap, board text description) · e2e coverage for all of it.
**P1, Stage 4 items that do not need AI or hosting:** achievements, share cards, daily challenge (C5).
**P2, Stage 3:** levels 6–20 in chapters, each through the existing solver gates (0 dead states, optimal, budgets, hints, tests).
**Blocked:** real AI experiment and recordings (C4), deployment (C9), human playtests and cross-browser/device (C10).

## 6. Governance
Each package follows the TheDuck sequence and updates `docs/verification/evidence-ledger.md` with implemented / tested / independently verified / not verified / blocked. No milestone is called complete without evidence; the DoD checklist is tracked in `docs/product/dod-tracker.md` once Stage 1 begins.
