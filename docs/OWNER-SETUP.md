# Owner setup guide (about 15 minutes)

Two things only you can do. Development does not wait for either: the game, levels and tests all work without them.

## A. Put the game online (GitHub Pages)

1. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Get the code on `main`: open a pull request from `claude/humans-vs-ai-plan-fz5yq0` and merge it. (Pages deploys from the default branch only. To deploy from this branch instead, add it under **Settings → Environments → github-pages → Deployment branches**.)
3. **Actions → Deploy to GitHub Pages** should run green. The address is `https://rajat4493.github.io/HumVAi/`.
4. Run the 4-step smoke test at the bottom of [`DEPLOY.md`](DEPLOY.md) on the live address and tell me the result. Until then the release gate "deployed and smoke-tested" stays unmet.

No secrets are needed for the website. It is static and contains no API keys.

## B. Let the AI opponent be recorded for real (API credentials)

The browser never talks to an AI provider. Recordings are made once, offline, by the runner on a machine you control, then checked in as static files. That is why keys must never go in the repository, the website, or a chat.

1. **Create two keys** in the provider consoles: one Anthropic, one OpenAI. Give each a **monthly spend limit** in the console (a hard ceiling that does not depend on our software). Use keys dedicated to this project so you can revoke them afterwards.
2. **Choose the models.** Send me the exact model identifiers (for example the ones shown in each console's model list), plus a spend cap in USD for the pilot. I will not guess identifiers or prices.
3. **Put the keys in your own shell, not in a file in the repo:**
   ```
   export ANTHROPIC_API_KEY=...      # read only by the runner process
   export OPENAI_API_KEY=...
   ```
   Then, from a machine that can reach both provider hosts (the cloud session here cannot reach `api.openai.com`):
   ```
   npm run runner -- preflight --model anthropic:<id> --model openai:<id>
   ```
   Preflight checks each id against the provider's own list and spends nothing.
4. **Pilot, then verify:** run one attempt per model on World 1 with `--spend-cap-usd <your cap> --prices experiments/prices.json` (copy `experiments/prices.example.json` and fill in the provider's published prices), then `npm run runner -- verify`. Commands are in [`ai/runner.md`](ai/runner.md). Only after the verification passes do I publish recordings into `apps/web/public/recordings/`.
5. **If a key leaks** (pasted anywhere, committed, shown in a log): revoke it in the console immediately, then create a new one. `npm run scan:bundle` and a lint rule keep keys out of the website build, but they cannot protect a key you paste elsewhere.

Until step 4 passes, the game honestly says no recorded AI attempt exists. Reference-solver fixtures only appear with `?fixtures=1` and are labelled "Reference solver (not an AI)".

## What I will not do without you
Spend money, use a key you did not give me for this purpose, publish an AI result I have not independently verified, or call real AI competition complete before verified provider recordings exist.
