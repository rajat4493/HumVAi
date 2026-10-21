# M1 implementation plan (Task 4; planning only, nothing started)

Principle: **measure the AI before scaling content, and build the rivalry seams before polish.** M1 is the plan's "beautiful playable vertical slice" plus the minimum AI machinery needed to know whether the contest is real. Every work package (WP) below is independently testable and has acceptance criteria (AC), risks and verification. Sizes: S ≤ 2 days, M ≈ 3–5 days, L ≈ 1–2 weeks (single developer-equivalent; relative, not a commitment).

## Order and gates

```
G0  Preservation + CI (WP-00)
 ├─ Track A: Measure         WP-10 → 11 → 12 → 13 → 14 → 15 → [GATE A: experiment report] → WP-16
 └─ Track B: Product         WP-20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 ──► [GATE M1] after WP-28 (playtest)
 Shared: WP-01 (schemas) before A and B; WP-02 (level linter) before WP-16/WP-27
 Research (optional, parallel): WP-17 condition-B study
```
**Gate A (after WP-15):** experiment results for all five worlds with ≥ 1 model are reported with replay-verified records. Outcome decides WP-16 (retune worlds) and whether Scout & Run needs the B variant (WP-17). Product Track B can proceed in parallel but **no new worlds are authored** until Gate A.
**Gate M1:** the plan's M1 gate: all five worlds playable on desktop and mobile, tests pass, real users understand the controls (WP-28), plus a Gate-A report in the repo.

---
## WP-00 Preservation and CI (S) — prerequisite
- **Work:** GitHub access fixed and branch pushed; CI workflow (install, typecheck, lint, unit, level verification, build, e2e on desktop+touch); archive artifact on release.
- **AC:** branch visible on GitHub at the pushed commit; CI green on that commit; a fresh clone passes `npm ci && npm run check`.
- **Risks:** org permissions; Chromium availability in CI.
- **Verification:** screenshot/URL of the green run recorded in the evidence ledger; clone test from the remote (not from the ZIP).

## WP-01 Shared schemas and RunRecord (M)
- **Work:** versioned types and validators for `hva.obs.1`, `hva.act.1`, `hva.reply.1`, `hva.run.1` (incl. `condition`, `attemptId`, obs hash chain), JSON Schema files; location `packages/shared` (decision D1) or inside `game-core`.
- **AC:** (1) round-trip tests; (2) invalid fixtures rejected with precise errors; (3) the serialized turn message of every world contains none of the hidden-rule keys; (4) a golden snapshot per world for the observation message; (5) schema version bump required by a CI check when a snapshot changes.
- **Risks:** premature schema churn; mitigated by `hva.*.1` versions and golden tests.
- **Verification:** unit tests; snapshot diff in CI.

## WP-02 Level linter (S)
- **Work:** CLI/CI check over `LEVELS`: entity ids neutral (denylist words such as `decoy`, `real`, `opens`, `jam`, `trap`, `fake`; ids may not reference another entity), version bumped when a level's content hash changes, run-budget ≥ optimal, `E` rules per tier, dead-state = 0, W5-style "rule change essential" where `shift` exists, no hidden key in briefing text.
- **AC:** all five worlds pass; a set of deliberately bad fixtures each fail with the right message.
- **Risks:** word-list false positives; keep it small and explicit.
- **Verification:** unit tests over fixtures; runs inside `npm run check`.
- **Note:** current ids contain colour words (`switch-orange`); that is visible to humans too (acceptable); `switch-teal` being the decoy is not encoded in the id.

---
## Track A — Measure (the AI experiment)

## WP-10 Prompt and observation freeze (S)
- **Work:** implement the turn builder exactly as specified (system prompt, per-turn message, history policy) as a pure function; golden snapshots; parity manual text shared with the web How-to-play panel (decision D3).
- **AC:** golden tests for one turn per world and for a full scripted attempt; hash of the system prompt exported; test proves nothing outside `observe()+events+legalActions()+briefing` appears in the message; web How-to-play text equals the system prompt's rules paragraph (single source).
- **Risks:** prompt wording drifting after freeze; mitigated by hash in every record.
- **Verification:** unit tests; hidden-key scan.

## WP-11 Adapter interface, scripted and random adapters (M)
- **Work:** `ModelAdapter` types, `AdapterError`, scripted adapter (fixed action list), random legal-action adapter, contract-test suite any adapter must pass (message fidelity, error mapping, usage fields, timeout/abort).
- **AC:** scripted adapter reproduces each world's optimal solution and a deliberate loss; random adapter never crashes the runner across 1,000 attempts; contract suite runs against both.
- **Risks:** leaky abstraction across providers; keep `extra` pass-through minimal.
- **Verification:** unit + contract tests; no network.

## WP-12 First real provider adapters (M)
- **Work:** one adapter per chosen provider (at least two providers: decision D2) implementing the contract; structured reply via the provider's native mechanism or JSON text with a parser; usage and latency mapping; identity capture from API response.
- **AC:** contract suite passes against recorded provider fixtures (no live call in CI); a manual live smoke run of 1 attempt on World 1 per provider completes and verifies; API keys only via environment, never logged or committed.
- **Risks:** provider API changes, rate limits, refusals, differences in reasoning-token reporting; secrets leakage.
- **Verification:** contract tests on fixtures; secret-scan in CI; live smoke log attached to the ledger.

## WP-13 Runner (M)
- **Work:** CLI that runs the attempt state machine, limits (§6 of the experiment spec), void handling and re-runs, interleaved seeded ordering, JSONL store, spend cap, resumable.
- **AC:** with the scripted/random adapters: all limits fire correctly (rejection cap → forfeit, timeout/overflow → void with reason, spend cap → clean stop), a killed run resumes without duplicating attempts, records validate against `hva.run.1`; 50-attempt batch completes in a deterministic order for a given seed.
- **Risks:** partial writes; double-billing on resume; mitigated by append-only writes and idempotent attempt ids.
- **Verification:** integration tests with fake adapters and injected faults.

## WP-14 Replay verifier (S)
- **Work:** `verify-runs` CLI per §10: obs-hash chain, event equality, outcome and state hash, budget invariants.
- **AC:** passes every runner-produced record; **fails** on each of six corrupted fixtures (changed action, changed obs hash, extra action after end, wrong scout count, wrong level version, truncated steps); exit code non-zero on any failure; output lists exact step of divergence.
- **Risks:** verifier shares code with the engine, so engine bugs could hide; mitigated by golden hash fixtures committed from independent hand-checked runs.
- **Verification:** unit tests with fixtures; golden hashes.

## WP-15 Cost/latency ledger, report generator, experiment execution (M)
- **Work:** price table loader, per-call/attempt/world/model aggregation, Wilson intervals, discovery-event extraction, markdown report; commit `PREREG.md`; dry run (1 attempt per world) → costed extrapolation → approval → full run (10 per world per model).
- **AC:** report reproduces from the JSONL by a single command; all included records verified; voids/unverified listed; interpretation uses only the pre-registered thresholds; **Gate A report** committed with costs, latencies, success counts with intervals, discovery events, and a plain-English reading.
- **Risks:** spend overrun; provider drift mid-run; over-reading N=10; mitigated by spend cap, config hashes and wording rules.
- **Verification:** report regenerated by CI from committed (anonymous) fixtures; a reviewer re-derives two numbers by hand from raw records.

## WP-16 Retune worlds from the data (M) — after Gate A
- **Work:** apply the pre-registered consequences: tighten Scout below the optimum where trivial, adjust budgets, or add/modify worlds. Every change bumps the version and passes the linter and solver.
- **AC:** each changed world re-verified (solvable, 0 dead, shift essential where relevant); re-run of the AI experiment on changed worlds shows the intended movement or the change is reverted.
- **Risks:** chasing the model (overfitting to one model); mitigated by ≥ 2 models and descriptive-only claims.
- **Verification:** solver report, re-run report.

## WP-17 Condition-B study (research, M, optional)
- **Work:** variant validator and pool for W2 and W4 rule families (feasibility already measured); run condition B1 in the harness; compute memorization index; record `condition: "B1"`.
- **AC:** ≥ 12 validated variants per family with optimal within ±1 of the authored world; A vs B1 comparison table in the report; decision rule from `scout-run-evaluation.md` §4 applied.
- **Risks:** generated worlds look arbitrary; the AI result may not predict human experience.
- **Verification:** validator unit tests; comparison report.

---
## Track B — Product slice

## WP-20 Human RunRecord capture and local saves (M)
- **Work:** record every human attempt as `hva.run.1` (condition, per-step events, obs hash), persist in `localStorage`/IndexedDB with try/catch and in-memory fallback; resume after refresh; "forget my data" control.
- **AC:** refresh mid-run restores exactly (engine replay of stored actions equals live state); corrupted storage is ignored without crashing; storage unavailable → game still playable; records validate and replay-verify with the same verifier as WP-14.
- **Risks:** storage quotas/blocked storage; privacy copy (no accounts, local only).
- **Verification:** unit + e2e (reload test, blocked-storage test).

## WP-21 World map and progression (M)
- **Work:** the Welcome → World Map → Briefing → Arena → Result flow for five worlds, locked/unlocked states, best run per world, local progress; replaces the review-only Next button.
- **AC:** completing a world unlocks the next; progress survives refresh; deep links `?level=` still work for tests; keyboard and touch operable; map readable at 390 px.
- **Risks:** feels like menu overhead; keep ≤ 2 taps to play.
- **Verification:** e2e on desktop and touch; accessibility check of the map (focus order, labels).

## WP-22 Result reveal v1 on fixtures (L)
- **Work:** implement §2–§4 and §6 of the rivalry spec against **fixture** AI records (labelled "Reference solver (not an AI)" until real records exist): five outcomes, head-to-head rule as a pure function, distribution strip, optimal marker, copy deck.
- **AC:** head-to-head function has table tests for every branch (won/lost × runs × scout × tie × both failed × inconclusive); H1, H2, H5, H6, H8 tests pass; reveal never shows AI numbers before the human result; reduced-motion variants exist.
- **Risks:** the reveal is the emotional core and easy to over-design; keep animations data-driven and short.
- **Verification:** unit (rule), component, e2e with each fixture; visual review against screenshots.

## WP-23 Ghost replay player (M)
- **Work:** §5 of the spec: replay engine-driven from any `RunRecord` (human or AI): fixed cadence, speeds, step/scrub, phases, event captions, notes with H4 label, Race view.
- **AC:** replay of a record reproduces its events and final hash exactly; constant step interval (±20 ms) at every speed; pause/step/scrub never desynchronise board and counters; H1–H4 tests pass; no forbidden strings (`thinking`, `live`, typing indicator) in the replay bundle.
- **Risks:** drift between replay and live renderer; mitigated by driving both from the same scene code.
- **Verification:** golden replay tests, timing test, string denylist test, e2e.

## WP-24 Audio engine and cues (M)
- **Work:** Web Audio synthesiser and cue table from §7; mute/volume in Settings; gesture-gated unlock.
- **AC:** each cue fires once per trigger (spy test); silent before first gesture; mute persists across refresh; peak level ≤ −6 dBFS measured offline on rendered cues; no cue longer than 1 s; sound never the only signal (visual twin checked per cue).
- **Risks:** autoplay policies, iOS Safari audio unlock, user annoyance; ship with Sound toggle visible at first run.
- **Verification:** unit tests with a fake AudioContext, offline-rendered level measurement, manual device check (documented, may remain "unverified").

## WP-25 Outcome animations (S)
- **Work:** §6 animations as scene/CSS timelines with reduced-motion variants.
- **AC:** each outcome ≤ stated duration; reduced-motion shows none of particle/flash/slide; no animation uses red for the AI.
- **Risks:** performance on low-end phones; keep particle counts fixed.
- **Verification:** component tests (reduced-motion), frame-time probe on desktop, device pass in WP-27.

## WP-26 Accessibility pass (M)
- **Work:** focus trap and return in dialogs, live-region/board text description from `PublicGameState`, high-contrast token set, colour-blind check of switch palette, How-to-play panel, touch target audit.
- **AC:** keyboard-only completion of world 1–5 and of the reveal/replay; screen-reader description updates after every action (live-region test); contrast ≥ 4.5:1 text, ≥ 3:1 non-text on measured tokens; automated axe-core run has 0 serious/critical violations on all screens.
- **Risks:** Phaser canvas is opaque to assistive tech; the text description must be complete enough to play (it is: `renderAscii` already is).
- **Verification:** axe-core in e2e, manual screen-reader smoke (documented), contrast script.

## WP-27 Performance and device pass (M)
- **Work:** lazy-load Phaser after Welcome, measure load and frame time on ≥ 2 real phones and 1 low-end laptop, fix regressions.
- **AC:** first interaction (Welcome playable) ≤ 3 s on a throttled "fast 3G/mid-tier phone" profile (provisional target from the plan); ≥ 55 fps median during play on the reference devices or documented deviation; bundle budget recorded.
- **Risks:** Phaser size (332 KB gz); real-device access.
- **Verification:** Lighthouse/WebPageTest profile, performance trace attached; device notes in the ledger; anything not measured is reported as unverified.

## WP-28 Playtest and Gate M1 (M)
- **Work:** protocol for 5–8 non-technical players (unaided), tasks, observation sheet, metrics (completion, resets, time to first action, Start-run discovery, drag discovery, stalls in W4/W5), post-session questions (the "Open design questions" in the rivalry spec §11 and the review's playtest questions); report.
- **AC:** report committed with raw (anonymised) observations; each M1 gate criterion marked met/unmet with evidence; decision list for M2.
- **Risks:** recruiting; observer bias; mitigated by a fixed script and no coaching.
- **Verification:** session recordings/notes, coded tally reproducible from raw notes.

---
## Cross-cutting definition of done (every WP)
Typecheck, lint, unit tests and the level verification pass in CI; new behaviour has tests that would fail without it; docs updated in the same change; the WP's evidence-ledger rows list *implemented / verified / untested*; no scope outside the WP.

## Explicitly not in M1
Accounts, backend/database, leaderboards, multiplayer, payments, analytics beyond local playtest notes, the 20-level campaign, live (real-time) AI mode, voice or music, mobile app stores.

## Risk register (programme level)
| Risk | WPs | Mitigation |
|---|---|---|
| Worlds trivial or impossible for LLMs | 15, 16 | measure first; Gate A; no new content before it |
| Spend overrun or provider drift | 12, 13, 15 | dry run, spend cap, config hashes |
| Perceived dishonesty about AI presentation | 22, 23 | H1–H8 as tests |
| Scope creep into M2/M3 | all | gates and the "not in M1" list |
| Environment/permissions (GitHub) | 00 | fixed before anything else |
| Over-fitting to one model/prompt | 15, 16 | ≥ 2 models; frozen, hashed prompt |
