# Gameplay telemetry: data policy (DRAFT, not approved)

Status: **draft for the owner's decision.** What is built and switched on is **Option A only**. Nothing in Options B-D exists or may be enabled without written approval of the points under "Decisions needed".

## Option A: local, opt-in, manual export (built, shipped)
- **Default off.** Gameplay is identical with it on or off. Nothing is asked of a player who never opens the setting.
- **Where:** Settings > "Help test the game (optional)". Turning it on stores records in this browser's local storage (`hva.telemetry.v1`) and the choice in `hva.telemetry.consent.v1`. Turning it off, or pressing Delete, erases the records.
- **No upload.** The game contains no code path that sends this data anywhere (tested: no network request during recording and export). A player may download a file and send it to the test team by their own choice; that act is the consent to share that file.
- **Bounded:** at most 300 attempts and about 1.5 MB on the device; oldest dropped first.

### What a record contains
| Field | Why |
|---|---|
| Per attempt: random attempt id (not linked to anything), world id and version, start time rounded to the hour, device class (touch or pointer) | tie results to the exact world version; see whether phone play differs |
| Every valid action in order: type, Scout or Run, time since the attempt began (10 ms steps), names of the events it caused, a hash of the observation shown afterwards | reconstruct exactly what the player saw and did (observations are re-derived by replaying the actions; the hash proves it) |
| Resets, Start-run (commit), hint openings (tier, time, action count) | Scout use, recovery, help-seeking |
| Outcome: won, lost or abandoned; run and scout action counts; whether hints were used; duration | difficulty and drop-off |
| Export header: schema, policy wording version, game build (commit), export date | interpret the file later |

### What is never recorded
Name, email, account, IP address (the host is static; the game has no server of its own), location, browser or operating-system details, language, time zone, screen size, other tabs or sites, anything typed, anything outside the game page, the player's saved progress, or a persistent device or install identifier.

## Decisions needed before anything beyond Option A
1. **Server-side collection (Option B).** Which host and country; who can read it; retention period (suggest 12 months then delete); deletion on request (needs some way to identify a file without identifying a person, e.g. a code the player keeps); security; incident process; whether children may play (age gate or "not directed at children" statement); legal basis and notice wording (GDPR/UK GDPR consent, CCPA notice) reviewed by someone qualified.
2. **Third-party sharing (Option C).** None approved. Any analytics vendor or data processor must be named, contracted and disclosed to players first.
3. **Reuse for model training or benchmarks (Option D).** None approved. Gameplay is behavioural data about people. If wanted: a separate, specific, unticked-by-default consent; anonymisation review; a published dataset licence; no use on data collected under Option A wording.
4. **Consent wording.** The text in Settings is the proposed wording (policy tag `draft-1`). If it changes, the tag changes and consent is re-asked.

## Principles applied
Collect the least that answers the question; derive rather than store (observations); round what is precise (time, hour); keep it on the device unless the player moves it; make off the default and deletion one click; never tie records to a person; say plainly what is and is not collected.
