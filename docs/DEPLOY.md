# Deployment (GitHub Pages)

The game is a static site (`apps/web/dist`): no server, no API keys, no database. GitHub Pages is a suitable host.

## What is in the repository
- `.github/workflows/ci.yml`: on every push and pull request: `npm ci`, `npm run check` (types, lint, unit tests, level solvability, recording verification, production build, key scan), then the Playwright browser tests.
- `.github/workflows/pages.yml`: on push to `main` or by hand (`workflow_dispatch`): runs the same `npm run check`, uploads `apps/web/dist` and deploys it with the official Pages actions.
- `apps/web/vite.config.ts` uses `base: './'`, so the build works at a domain root and under `https://<owner>.github.io/HumVAi/`.

## What the repository owner must do (cannot be done from a coding session)
1. In the GitHub repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge `claude/humans-vs-ai-plan-fz5yq0` into `main` (or run the "Deploy to GitHub Pages" workflow manually; GitHub's `github-pages` environment only allows the default branch unless you add this branch under **Settings → Environments → github-pages → Deployment branches**).
3. The expected address is `https://rajat4493.github.io/HumVAi/`.

## Pre-flight (run locally before the owner steps)
`npm run check && npm run test:e2e && npm run verify:subpath` all pass on this branch. The sub-path check serves the production build under `/HumVAi/`, as Pages does, and plays World 1 with no console errors or failed requests. See `docs/RELEASE-QA.md` for the full verified / not-verified list.

## Status
**Not deployed and not verified.** No live URL has been loaded, and the workflows have not been run on GitHub. Until they run green and the live URL is smoke-tested (open it, play World 1, reload, check the saved progress), the release gate "deployed and smoke-tested" is **unmet**. The production build, its key scan and the browser tests do pass locally against `vite preview`.

## Smoke test to run on the live URL
1. Title screen loads; Play opens the map; only World 1 is open.
2. Play World 1 to a win; the reveal says there is no recorded AI attempt yet (no fabricated result).
3. Reload: progress is still there. Settings: toggle sound/motion; both persist.
4. The browser console shows no errors; the network tab shows no requests to model providers.
