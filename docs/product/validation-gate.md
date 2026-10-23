# Commercial validation gate (before any third game)

Principle: learn whether people want more *before* building more, with the least data and no analytics infrastructure. Nothing here is a monetisation feature.

## The six questions and how each is measured without a server
| Question | Signal | How, with what already exists |
|---|---|---|
| How many visitors start a game? | starts / visits | **Hosting-side counts only**: the GitHub Pages traffic page (repo Insights > Traffic: unique visitors, views) gives visits; starts are counted from players who opt in and send their file (`run_start` / `attempt_start` events) plus the playtest observation sheet. State the sample size; never extrapolate |
| Experiment completion and abandonment | worlds finished, attempts abandoned, last world reached | The opt-in file already has per-attempt outcomes (`won`/`lost`/`abandoned`); `tools/analyze-playtest.ts` tabulates them per world |
| Repeat play | returns on another day | Not measurable without an identifier, by design. Proxy: ask playtesters "did you come back?" at a 3-day check-in message, and count files whose attempts span more than one calendar day (`startedAt` is hour-rounded) |
| Interest in Pattern Hunter | opened the prototype; solved it; asked for more | `run_start` events, plus a one-question prompt in the playtest ("Would you want more of these? 1-5"). Do **not** add an in-game waitlist or email form (that collects identifiers) |
| Willingness to share a result | share button use | Currently a plain-text summary the player copies. Count by asking, or by the optional `share` event if the owner later wants it (new event type, same schema rules) |
| Does the AI rivalry motivate? | engagement with and without an AI result shown | **Cannot be tested until real, verified recordings exist.** Then compare, in the playtest, completion and replays on worlds with a recording against worlds without, and ask the direct question "Did seeing the AI change how hard you tried?" Until then no claim about rivalry is made |

## Method (lightweight and privacy-respecting)
1. Run 15-30 supervised or semi-supervised playtests (see `docs/qa/PLAYTEST-PROTOCOL.md`), each with an optional gameplay file and a 5-question survey.
2. Read the Pages traffic counts for the same period for the visitor number.
3. Put results in `docs/qa/playtest-results.md` and the verification ledger.

## Decision rules (set now so the data cannot be bent afterwards)
- **Proceed to a third game only if** at least 40% of testers who finish a first world open a second world on another day *or* at least half rate Pattern Hunter 4+ of 5 *and* at least 25% would send a result to a friend. If none holds, improve The Experiment or Pattern Hunter instead.
- **Do not** introduce monetisation, accounts or a server for analytics on the strength of fewer than 100 independent players.
- A server-side analytics proposal requires first the approved data policy (retention, access, deletion, consent wording).

## Risks of this method
Self-selected testers over-report enjoyment; manual file sending under-counts; Pages traffic counts include bots and the owner. The point is to catch gross failure early, not to prove demand.


## Addendum: the third game (DON'T PRESS THAT)
The decision rule above was written for a *third* game. One has been built as a **five-level vertical slice**, not as a commitment: it exists to find out whether a fast, funny, learnable rage platformer with a rival who makes checkable predictions is worth more levels. Its own gate, with thresholds fixed in advance, is `docs/games/dont-press-that/playtest-plan.md`: 10 to 15 external players, host on versus host muted, voluntary retries, perceived fairness, enjoyment, completion and willingness to challenge a friend. The slice does not satisfy this document's gate by being built; it satisfies it only if that test comes out well. No further levels, no fourth game and no monetisation until then.
