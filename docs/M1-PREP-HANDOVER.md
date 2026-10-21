# M1 Preparation Gate — handover

Status: preparation complete; **nothing implemented, M1 not started.** All four tasks are specifications; the only code run was throw-away measurement scripts (not committed).

## 1. Human summary

**Preservation first.** I could *not* confirm that the repository is safe outside this temporary environment. GitHub still refuses my push (permission error), so the remote has nothing. The only off-site copies are the ZIP and git bundle I sent you in chat. Please confirm you have them, or fix GitHub access (`docs/PRESERVATION.md`).

**The AI experiment (Task 1).** Specified so a real model plays each of the five worlds through the same engine, with exactly the human's information and budgets, no handicaps, ten independent runs per world, every run replay-verified, and cost and speed measured. Honest limits are built in: ten runs gives coarse answers (5 of 10 means "somewhere between 24% and 76%"). The measured size of the work: roughly 8.6 million input tokens per model in the worst case before caching; I did not invent prices, you supply them. The point of the experiment is to learn whether our worlds are too easy for a language model *before* we build more content.

**Scout & Run: same layout vs new layout (Task 2).** Keep the current design. The "new layout" idea (B) is better at testing real reasoning and at stopping memorisation, but it makes fairness and content harder and has no evidence yet. I measured that it is *feasible* (the engine can validate generated layouts quickly; about 1–3% of random layouts qualify) and I defined the cheap tests, on the AI first and then on players, and the thresholds that would justify switching.

**The rivalry experience (Task 3).** A complete screen-by-screen spec: how the AI is introduced (a respectful, non-human identity), how results are compared (head-to-head plus the ten-run context), a replay that shows the AI's recorded actions at a steady pace, five outcomes with animations (no red for the AI, no mockery), and audio. Its backbone is eight honesty rules: every AI element is badged RECORDED with model and date, never "thinking…", never before the human has finished, and each rule has a test.

**The M1 plan (Task 4).** Twenty work packages in two tracks: *measure* the AI first (specs, adapters, runner, verifier, experiment) and *build* the product slice (saves, world map, reveal, replay, audio, accessibility, devices, playtest). Two gates: after the AI report (decides whether to retune the worlds) and the M1 gate. No new worlds are written until the AI report exists.

## 2. Technical design (index)

| Topic | Document | Key points |
|---|---|---|
| Experiment | `docs/ai/experiment-spec.md` | `ModelAdapter` interface; schemas `hva.obs.1`, `hva.act.1`, `hva.reply.1`, `hva.run.1`; frozen system prompt; budgets = the level's; limits are operational only; config hash; 10 attempts per world; obs-hash-chain replay verification; cost ledger; scoring and ties; pre-registered thresholds |
| Scout & Run A/B | `docs/product/scout-run-evaluation.md` | comparison table; feasibility numbers; memorization index; evidence plan and decision rule; recommendation: keep A |
| Rivalry UX | `docs/design/rivalry-experience-spec.md` | honesty rules H1–H8; identity; reveal; replay at fixed cadence; outcomes and animations; audio cue sheet; layouts |
| M1 plan | `docs/product/m1-implementation-plan.md` | WP-00…WP-28, gates, risk register |
| Preservation | `docs/PRESERVATION.md` | status, checksums, restore steps |

## 3. Decisions requiring approval

| # | Decision | My recommendation |
|---|---|---|
| D0 | Fix GitHub access and confirm you hold the archives | Do first |
| D1 | New packages for M1: `packages/ai-adapters`, `packages/shared`, `apps/runner` (the original plan's layout, beyond the "minimal structure" you approved) | Approve only these three, only when their WP starts |
| D2 | Model roster and providers (≥ 2 providers; I can name the four Anthropic models available here, you name the others and give prices) | Two providers, one small and one large model each |
| D3 | Show humans the same How-to-play text the model receives | Yes (parity) |
| D4 | Reasoning/"thinking" left at each provider's default (no handicap) | Yes |
| D5 | Operational limits: 20 rejected actions, 300 s/call, spend cap you set | Approve |
| D6 | Ten attempts per world is enough for the gate | Yes for a gate; more for any published claim |
| D7 | Keep Scout & Run design A; collect B evidence only as a research flag | Yes |
| D8 | Hide the AI's result until the human finishes | Yes |
| D9 | Show the model's self-reported notes, labelled | Yes |
| D10 | Which attempt the reveal shows (median among successes, published rule) | Approve |
| D11 | Tie copy "Dead even." vs "A tie." | Your taste |
| D12 | Offer the computed shortest path after BOTH_FAILED | Yes, labelled "computed, not an AI" |
| D13 | Freeze new world authoring until the AI report (Gate A) | Yes |
| D14 | Live (real-time) AI mode stays out of M1/M2 | Yes |

## 4. Evidence ledger

| Item | Implemented | Verified | Untested / caveat |
|---|---|---|---|
| Repository preservation | ZIP + bundle created (restore-tested at `a65f405`), delivered in chat | `npm ci`, typecheck, 47 tests, level verification pass from the unzipped copy; bundle verified | **GitHub push fails (403); off-site copy unconfirmed by you** |
| Experiment spec | Document only | Prompt/turn sizes **measured** with the real engine and levels (table in spec §11); Wilson intervals computed; schemas consistent with existing types | No model has been called; prompt wording untested on a real model; prices not supplied |
| Scout & Run A/B | Document only | Feasibility **measured**: 56k random layouts validated by the real solver (799 and 435 qualifying; optimal length ranges 3–18 and 3–35) | Fun, fairness and memorization claims are reasoning, not data; scratch scripts not committed |
| Rivalry UX spec | Document only | Honesty rules each map to a stated automated test; copy and cues internally consistent with existing tokens and the head-to-head rule | Nothing built, no mock-ups rendered, no player has seen it; audio untested on devices |
| M1 plan | Document only | Dependency order checked against the specs; each WP has AC, risks, verification | Sizes are rough; no estimate validated |
| Existing code | Unchanged since `a65f405` | (previous ledger stands: 47 unit, 14 e2e, level verification) | |
| Tests rerun this gate | — | `npm run check` re-run after the docs commit (result in the delivery message) | |

## 5. TheDuck learning notes

- **Preservation is a gate, not a courtesy.** A persistent "push blocked" state should become a first-class blocker on the milestone board with an owner and a fallback artifact, rather than a note in a summary.
- **Specs for AI experiments need the same rigour as engines:** frozen inputs with hashes, versioned schemas, golden snapshots, a verifier that is itself tested against corrupted data, and pre-registered interpretation thresholds written *before* any data exists.
- **Measure before you design around a number.** The cost estimate came from running the real prompt builder on real levels, not from guessing; the B-variant claim came from sampling the real validator. Both changed the wording (e.g. "2.8% of random layouts qualify", "optimal length 3–35").
- **"No handicap" needs an operational/difficulty distinction** written into the spec (what limits exist, why they cannot bind normal play, and how a hit is reported), or it silently becomes a handicap.
- **Define honesty requirements as testable rules** (H1–H8) at spec time; UI specs that say "make it clear" cannot be verified.
- **Resist replacing a design on argument alone.** The A/B analysis ends with a decision rule and cheap experiments; the current design stays until evidence beats it.
- **Keep research scripts out of the product tree but record what they measured** (numbers and method in the doc) so a result is traceable even if the script is discarded; next time commit them under `tools/` with a README.
- **Gate content on measurement.** No new worlds before the AI report prevents building twenty levels on an unvalidated difficulty assumption.
