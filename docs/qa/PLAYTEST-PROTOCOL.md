# Human playtest protocol (v1.0 release gate)

Goal: find out whether people can finish the campaign, where they get stuck or bored, and whether the AI-comparison text is understood. Quantity matters less than variety: 5-8 people is enough to find the worst problems.

## Who
A mix: puzzle-game players and non-players, at least two on a phone, at least one on a laptop, ideally one person who relies on keyboard only or on a screen reader. Not people who have read the design docs.

## Setup (10 minutes each)
1. Give them the live URL only. Say nothing about the rules. "Play for about 30 minutes; tell me when you'd stop."
2. Ask (optional) that they turn on Settings > Help test the game, so you can get a file afterwards. Say what it records and that it never leaves their device unless they send it.
3. Watch without helping. Note: where they pause longer than a minute; what they say out loud; any time they press the wrong control; whether they find Scout before being told; whether they notice the AI panel and what they think it is.

## After play (5 questions)
1. In your own words, what were you doing in the Scout phase? What was the Run?
2. Which world was the most fun? The most annoying?
3. Did any world feel unfair or too long?
4. What did "The AI" mean to you? Did you expect to see it play?
5. Would you play another world? Why or why not?

## What to send back
Their downloaded gameplay file (if they chose to), plus your notes. Put files in one folder and run:
`npx tsx tools/analyze-playtest.ts <folder> --write docs/qa/playtest-results.md`
Every attempt is replayed through the engine; edited or mismatched attempts are excluded and listed.

## Reading the results (decide corrections only from evidence)
- A world where under half the attempts are won, or where more than a third are abandoned, needs a look: watch a replay, then decide between a hint rewrite, a budget change or a redesign.
- A world won by nearly everyone at the shortest possible length is probably too easy (fine in chapter 1).
- Hint use above 50% on a world means the first hint is not pointing anywhere useful.
- Device split: compare phone and desktop win rates; a gap means a control problem.
- Any change to a world bumps its version, so old and new attempts are never mixed.

## Recording the outcome
Add each playtest to `docs/VERIFICATION-LEDGER.md` (who, device, date, build commit, findings, what changed). Do not describe enjoyment as verified until this has been done with real people.
