# Real-AI pilot runbook (one Anthropic attempt, World 1)

**Needs from the owner (nothing here runs without them):** `ANTHROPIC_API_KEY` as an environment secret in the session (never in chat), the exact model id, the provider's published prices for that model, and a spend cap. The adapters have only ever talked to mock servers; this pilot is the first real contact.

## 0. Free checks (no key, no spend)
```
cp experiments/prices.example.json experiments/prices.json     # fill the model's two prices from the provider's price page
npm run runner -- estimate --model anthropic:<id> --prices experiments/prices.json --levels w01-first-steps --max-output-tokens 4000
```
Prints likely and worst-case cost. (Measured with an assumed rate of US$2 / $10 per million tokens, only to exercise the tool: World 1, one attempt, likely about $0.08, worst case about $2.2 at 4,000 output tokens per call. Every call re-sends the whole history, so input grows with the square of the number of calls.) Pick `--spend-cap-usd` at or below what you are comfortable losing; the runner stops new attempts at 90% of it and a running attempt at 100%.

## 1. Preflight (key required, no inference cost)
`npm run runner -- preflight --model anthropic:<id>` checks the id against Anthropic's own model list.

## 2. The attempt
```
npm run runner -- run --live --model anthropic:<id> --out experiments/pilot-1 --levels w01-first-steps --attempts 1 \
    --prices experiments/prices.json --spend-cap-usd <cap> --max-output-tokens 4000
```
Notes: the Messages API no longer accepts `temperature` or `top_p`, so none is sent (the adapter refuses them). A refusal or a model that cannot follow the reply format is recorded as it happened; nothing is retried to make it look better.

## 3. Independent verification
`npm run runner -- verify --out experiments/pilot-1` replays every recorded step through the engine and checks the observation hash chain, events and outcome. Then `report --out experiments/pilot-1 --write experiments/pilot-1/REPORT.md` and read it: cost, tokens, latency, rejected replies, flags.

## 4. Decide before spending more
Report to the owner: real cost against the estimate, validity (verified or not), and what the attempt looked like. Only then choose whether to widen (more worlds, then 3 attempts per world). Nothing is published from a pilot automatically.

## 5. Publish (only after owner approval of the result)
`npm run runner -- publish --out experiments/pilot-1 --model anthropic:<id>` writes the static recording the game ships; it refuses test players. Commit, redeploy, then run `npm run live-smoke` and look at the Reveal screen: it must say RECORDED with model, date and attempt, and never "live".

## What this does not prove
One attempt on World 1 shows the pipeline works. It says nothing about how well any model plays the campaign; that needs the wider runs.
