# M0 review corrections — summary

Status: corrections complete; **M1 not started**. Evidence: `docs/verification/evidence-ledger.md` and `docs/verification/m0-evidence.md`.

## Approved in review (recorded)
Stay on Phaser 3.90 · keep the level order · keep the minimal repository structure · keep the visual direction provisionally.

## 1. Level 3 — redesigned for recoverability
Was 137 of 178 states dead (77%). Now the block can be **dragged** (`INTERACT` on an adjacent block), the map is unchanged, and an exhaustive search finds **0 dead and 0 irreversible states out of 183**, optimal still 10. Experimentation is no longer punished. (Level versions bumped.)

## 2. Level 5 — the rule change is now essential
The far door is sealed until the rune is stepped on; then switch-two opens it. A search that prunes the rule change finds **no winning sequence**, and tests show the old strategy loses, every win passes through the change, and toggling in the wrong order busts the strict budget (17 > 16). Optimal is 13 (6 variants).

## 3. Budgets — Scout & Run
Scout: a sandbox with free resets that can never win or lose. Run: the strict scored attempt on a fresh world. One new action (`COMMIT`), one new counter. Early worlds are generous; advanced worlds keep Scout *below* the optimum so a route cannot be rehearsed. See `docs/product/budget-model.md`.

## 4. Experience validation
All five worlds played in a real browser on desktop and touch; 22 screenshots, 2 recordings, 7 defects found and fixed (block hidden under plate, invisible rule-change cue, cluttered mobile HUD, drifting HUD pill, premature "Humanity scores", keyboard hints on touch, key double-counting). No human players yet. See `docs/design/experience-review.md`.

## 5. The AI opponent (plan only)
Fairness model, frozen observation format, scoring and tie rules, transparent presentation of recorded attempts (labels, N samples, median attempt, replay-verified, self-reported notes), M1 seams vs M2 implementation, five decisions needed. See `docs/product/ai-opponent-plan.md`.

## Additions you did not explicitly ask for (flag if unwanted)
- **Drag mechanic** (the way Level 3 was fixed): a new core action meaning. Alternatives were a corridor with no choices (rejected: no puzzle) or a layout search (best found: 17% dead).
- **Review-only Next world flow** so progression and Scout & Run across all five worlds could be judged. There is still no map, saving or AI. It is not M1 scope and can be removed.
- Result headline changed to "You made it out." until an AI result exists.

## Decisions requiring your approval
1. Drag as a permanent mechanic (and its effect on later block puzzles).
2. Scout & Run as the budget model, and the numbers in the dial.
3. Auto-commit when the exit is found in Scout.
4. The five AI decisions in `docs/product/ai-opponent-plan.md` §6.
5. Whether to keep the review-only Next flow.
