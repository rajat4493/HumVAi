# Scout & Run: same layout (A) vs different layout (B) — evaluation (Task 2)

Status: analysis plus a small feasibility measurement. **The current design (A) is not replaced.** This document says what evidence would justify changing it and how to collect it cheaply.

## 1. The two approaches

**A. Same world (current).** Scout and Run use the identical layout and rules. Scouting can reveal the rules *and* the route. The world is reset between them.

**B. Same rules, different layout.** Scout reveals how the world behaves; the Run is a different map governed by the same rules. Two sub-variants matter:
- **B1: identities persist.** The orange circle still opens the door, the rune still rewires the far door; only walls, positions and distances change.
- **B2: identities are redrawn.** Which switch is real, which is jammed, etc. are re-assigned, so the Scout teaches the *kind* of rule ("some switches are decoys, some are conditional") but not the specific wiring.
B2 is a much larger departure; B1 is the natural first form of B.

## 2. Comparison

| | A. Same layout | B. Different layout, same rules |
|---|---|---|
| **Fun** | Familiar loop: poke, learn, then perform cleanly. Satisfying "I know exactly what to do" execution, risk of a flat Run (just replay). Early-world confidence is high. | Run feels like a fresh problem armed with insight ("I know how this works, now apply it"): higher tension and more "aha", but a chance of frustration ("my route is useless") and a more complex mental switch. Worlds feel less like authored puzzles when generated. |
| **Fairness (human vs AI)** | Simple and exact: both get the same world twice; identical information. The AI's Scout transcript is its memory, the human's memory is their head. Parity is easy to prove. | Needs matched variants: the Run layout must be equivalent in difficulty for every participant, so the **same pre-chosen variant must be given to human and AI**. A random sample of layouts has optimal lengths from 3 to 18 (measured, below); unmatched variants would make comparisons meaningless. Requires a validated variant pool and a rule for assigning one. |
| **Memorization** | **High where `E ≥ optimal`:** a participant can solve the world in Scout and replay the exact action list in the Run; the Run then measures recall and execution, not reasoning. (Today `E ≥ optimal` on worlds 2–5 by design.) Mitigated by setting `E < optimal` on advanced worlds, which stops rehearsal but also makes *discovery* harder. Also exposed across retries: a player who replays a world remembers it. | **Low within an attempt:** the Scout route does not transfer. **Returns across attempts** if the variant pool is small and fixed (a recorded AI attempt needs a finite pool, so the pool is finite). Cross-player sharing of solutions per variant is possible. Needs a large enough pool, or seeded generation. |
| **Genuine reasoning** | Tests *discovery* (find the rules) and *recall*; planning is trivial once the route is known. A model that scouts by brute force and then replays succeeds without understanding. | Tests *transfer*: abstracting a rule from one instance and applying it in another, plus fresh *planning* in the Run. This is closer to the intelligence comparison the product wants. It also needs the world to contain real rules rather than layout trivia; World 1 (no rules) has nothing to transfer. |
| **Scout budget design** | `E` is coupled to rehearsal risk, so it must be tuned world by world. | `E` can be generous everywhere (nothing can be rehearsed), which better encourages experimentation. |
| **Content cost** | One authored layout per world. | One Scout layout plus a validated Run pool per world, or a generator with a solver-based validator. |
| **Engineering cost** | None (done). | Variant generator or authored pairs, a validator (door necessary, 0 dead states, optimal within ±1 of the Scout layout's, rule-change essential for W5), pool management, variant assignment recorded in `RunRecord`, replay verification extended to two layouts. |
| **Explainability to players** | "Practice, then the real thing." | "Practice in one room, perform in another that works the same way." Needs a clear framing. |
| **Fit with recorded AI attempts** | One recording per world. | Recordings per variant (N × variants). |

## 3. What would be needed for B (not built)

A *variant spec*: `(rule set, seed) → ChallengeDefinition`, produced by a generator or authored, and accepted only if the existing solver proves: solvable; the gating object is necessary (remove the door → unsolvable; remove the block → unsolvable); **0 dead states** (World 3 family); the rule change is essential (World 5 family); optimal length within ±1 of the Scout world's; run budget derived by the same ratio. Each accepted variant gets an id and is frozen and versioned like a level.

**Feasibility measurement (done in M1 prep, scratch code, not committed).** Random 9×5 layouts for the World-2 rule family (a real and a decoy switch behind a door that must be passed) and the World-3 family (block, plate, door), validated with the real engine and solver, 30,000 samples each:

| Family | Samples | Solvable | Door *necessary* (every route) | Of those, optimal length 8–14 | Optimal length of valid layouts (min / median / max) |
|---|---|---|---|---|---|
| Switch + door (W2 rules) | 28,093 | 18,066 (64%) | 799 (2.8%) | 457 (1.6%) | 3 / 8 / 18 |
| Block + plate + door (W3 rules) | 28,145 | 20,695 (74%) | 435 (1.5%) | 229 (0.8%) | 3 / 10 / 35 |

Reading: the engine and solver can validate variants quickly (≈ 50 s for 60k candidates) and hundreds of qualifying layouts appear per 30k samples, so **B is mechanically feasible**. It also shows why unconstrained random variants are unfair (optimal 3–35) and that raw random layouts are mostly unremarkable. Quality (are they fun?) was *not* measured and cannot be by this method.

## 4. Evidence plan (cheap first)

1. **AI experiment, condition B1 (offline).** Reuse the experiment harness (`docs/ai/experiment-spec.md`): run each world's Scout in the authored layout and the Run in a validated variant, 10 attempts. Compare with condition A on: success `k`, run waste, and a **memorization index** (below). Cost: roughly the same as A.
2. **Memorization index** (deterministic, from any record): `reuse = 1 if the Run action list equals a winning line found during Scout (or contains it as its first |line| actions), else 0` and a softer `LCS(run, scoutPathToExit) / |run|`. In A, a high index means the Run measured recall.
3. **Human micro-study** (once M1 playtests exist): between-subjects A vs B on worlds 2 and 4, ≥ 12 players per arm, no coaching. Measure completion, run waste, time to first Start-run, resets, a 1–5 fun rating and a "did you understand why it worked" question.
4. **Decision rule (proposed, adjustable before data):** adopt B1 for a *world* only if all hold:
   - in A the memorization index is high (≥ 0.8 of human or AI attempts that won reused their Scout line);
   - in B1 the AI still wins in at least the contest band (not collapsed to 0) and human completion in B1 is ≥ 70% of A's;
   - the human fun rating in B1 is not lower than A's by more than 0.5 points;
   - a validated variant pool of ≥ 12 exists.
   Otherwise keep A for that world and handle memorization with `E < optimal`.
5. **Adopting per tier rather than globally** is allowed: A for worlds 1–3 (teaching), B for advanced/Frontier worlds, if the data say so. This is a hypothesis, not a recommendation.

## 5. Recommendation for now

Keep A as the shipped design for M1. Add `condition` (`A`/`B1`) to the run-record schema now so B data can be collected without migration. Treat B1 as a research flag behind the experiment, and revisit when the AI experiment and the first human playtests exist. If, in A, an advanced world's `E` must be set below the optimum to stop rehearsal, that world is the first candidate for B1.
