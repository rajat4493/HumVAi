# Verification ledger

One row per claim the project makes. **Verified** = a check was run and its result is recorded here. Anything not in this table is not claimed. Update on every milestone; never upgrade a row without the evidence.

Last updated at repository commit: see `git log -1` of this file. Deployed site (owner-run, GitHub Pages): built from `a6af111`; the Space/Hints fix `2da6eb3` and everything after it is **not yet deployed**.

| # | Claim | Evidence | Status |
|---|---|---|---|
| L1 | All 20 worlds are solvable within budget, have no dead states, and their solutions replay | `npm run verify:levels`; 244 unit tests | **Verified** (machine) |
| L2 | All 20 worlds can be won through the real controls on keyboard and phone touch | `tests/e2e/campaign.spec.ts` (Chromium desktop + phone emulation) | **Verified** (Chromium only) |
| L3 | The worlds are fun, fair and clear to real people | none | **Not verified** (needs human playtest) |
| G1 | Saves, resume, reset, blocked-storage fallback work | unit + e2e | **Verified** (Chromium) |
| G2 | Phone tiles at least 36 CSS px on all worlds; pad buttons at least 44 px | e2e `smoke.spec.ts` | **Verified** (emulated 390x780) |
| G3 | Accessibility: no serious/critical axe violations on every screen; keyboard play; focus handling | `a11y.spec.ts` | **Verified** (automated); screen readers **not verified** |
| G4 | Space after closing a dialog plays the game, not the Hints button (reported by the owner on the live site) | e2e regression test, commit `2da6eb3` | **Verified in code; not yet deployed** |
| D1 | The site is live and playable | owner reported "works great" on the Pages build of `a6af111` | **Verified by owner** (no URL recorded here; github.io is unreachable from the sandbox) |
| D2 | Production build works under `/HumVAi/`, no errors, no provider traffic, no key-like text | `verify:subpath`; `tools/live-smoke.mjs` (67 checks, local copy, desktop + two phone profiles) | **Verified locally**; live-site run **pending** (needs a machine that can reach github.io) |
| D3 | CI runs on GitHub and is green | Actions runs 1-9 on this branch | **Verified** |
| A1 | Recorded-opponent display, comparison and tamper rejection work; fixtures cannot be mistaken for AI | unit + e2e + live-smoke | **Verified** with reference fixtures only |
| A2 | The runner and Anthropic adapter can complete a real attempt | mock servers only | **Not verified** (no key, model id, prices or cap) |
| A3 | A real, independently verified AI recording exists | none | **Not verified**; the game says so |
| A4 | Cost of a pilot is known in advance | `runner estimate` (tool built and tested; numbers use placeholder prices) | **Tool verified; real cost not measured** |
| T1 | Telemetry is off by default and records nothing until opt-in | unit (no storage writes) + e2e (no keys, one origin) | **Verified** |
| T2 | Telemetry never sends data anywhere | unit (fetch never called) + e2e (requests); no upload code exists | **Verified** |
| T3 | Exported gameplay replays to its recorded observations (cannot be quietly edited) | unit + e2e download replayed with the engine; analyser excludes forged attempts | **Verified** |
| T4 | A data policy is approved | `docs/privacy/telemetry-policy-DRAFT.md` is a draft | **Not approved**; server collection, third-party sharing and training reuse stay disabled and unbuilt |
| B1 | Works in Firefox and Safari (WebKit) | CI job `cross-browser` on `97b7fc6`: 131 of 133 gameplay tests passed across Firefox, WebKit and an iPhone 13 profile, including winning all 20 worlds by touch in WebKit. Two failures: (1) **real bug**: on short phone screens (WebKit iPhone profile is 664 px tall) tall boards shrank to 32 px tiles and spilled out of their frame; fixed by compacting the phone header and hiding the two side cards below 720 px height (40 px tiles; tested at 780 and 664 px); (2) Firefox axe contrast reading on the replay panel, most likely mid fade-in; test now waits for the animation | **Verified on CI**: the re-run on `ce85acb` passed the whole gameplay subset in Firefox, WebKit and the iPhone profile (run 39866878465). Real devices and real Safari on iOS (audio unlock, touch feel) still **not verified** |
| B2 | Works on real phones and tablets | none | **Not verified** (no devices) |
| H1 | Human playtests completed | none; protocol in `docs/qa/PLAYTEST-PROTOCOL.md`, analyser in `tools/analyze-playtest.ts` | **Not done** |

## Assumptions challenged
- *"Mock tests show the AI runner works."* No: a real provider can differ in response shape, refusals, thinking tokens, latency and cost. Hence the one-attempt pilot with a cap. One thing already found without a key: the Anthropic API stopped accepting `temperature`/`top_p` on 2026-10-21; the adapter would have sent nothing by default, but now refuses them explicitly.
- *"Telemetry needs a server."* Not for the questions we have. Local opt-in plus a downloadable, replay-verifiable file answers the playtest questions with no data policy risk. A server is only worth the policy cost if self-selected manual submission proves too thin.
- *"Passing the solver means a good level."* Solver gates prove solvable, not enjoyable; hence playtests.
- *"Chromium passing means it works."* Only for Chromium. Other engines run in CI.

## Open escalations (owner)
1. Anthropic key (as an environment secret), exact model id, published prices, spend cap, for the one-attempt pilot (`docs/ai/PILOT.md`).
2. Telemetry policy decisions listed in `docs/privacy/telemetry-policy-DRAFT.md`, only if anything beyond local opt-in is wanted.
3. Re-run the Pages deploy from the latest commit; find 5-8 playtesters.
