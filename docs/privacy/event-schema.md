# Game-neutral event schema (`hva.event.1`)

Status: **schema and local-only demonstration** (M2.3). There is no collection pipeline, no server and no third party. Data exists only if a player opts in (Settings > Help test the game) and stays in that browser unless they download a file and send it themselves. Governing policy: `telemetry-policy-DRAFT.md` (draft, not approved).

## Envelope
| Field | Meaning |
|---|---|
| `schema` | always `hva.event.1`; bumped for any incompatible change |
| `game` | `{ id, version }`: `experiment` / `campaign-1`, `pattern-hunter` / `proto-0.1` |
| `challenge` | `{ id, version }`: the world or puzzle and its version, so results are never mixed across redesigns |
| `session` | random per visit (`s-` + 6-24 lowercase letters/digits); not stored across visits, not linked to a person or device |
| `type` | event type, lowercase with underscores; must be in the game's registered vocabulary |
| `seq` | 0, 1, 2 ... within the session |
| `t` | milliseconds since the visit began, rounded to 10 ms |
| `payload` | per-game, per-type object, validated against a field table; unknown fields are rejected |

## Why free text cannot get in
Payload fields may only be integers, booleans, fixed-choice strings (`oneOf`), or short identifier-like strings (`[a-z0-9_-]{1,40}`). A name, an email or a sentence fails validation and the event is dropped, never stored. A test asserts exactly that.

## Vocabularies
**experiment** (derived from the Experiment's own replay-verifiable record, which is unchanged): `attempt_start {device, resumed}`, `action {phase, kind, events[]}`, `hint {tier, at_action}`, `outcome {status, run_actions, scout_actions, scout_resets, run_resets, assisted}`.
**pattern-hunter**: `run_start {probe_budget, examples}`, `probe {n, fits, probes_left}`, `predict_start {probes_used}`, `submit {correct, total, solved, probes_used, said_yes[]}`, `reset {after_submit}`.

## Adding a game
Register its vocabulary in `apps/web/src/telemetry/schemas.ts` (a field table per event type) and emit through `events.emit(...)`. Nothing else changes. A game's own richer, verifiable record (like the Experiment's) can stay private to that game; the envelope is the neutral view.

## What is validated
Every event on the way in (`EventLog.emit`), on the way back out of storage, and on neutral export (the export reports how many were dropped). `checkSequence` verifies a clean 0..n-1 run per session and non-decreasing time. Verified by unit tests (17) and a browser test that plays Pattern Hunter with consent, reads the stored events, validates them, downloads the neutral file and deletes it.

## Not decided here
Retention, hosting, access, legal basis, and any use beyond the local playtest file: see the policy draft's "Decisions needed".
