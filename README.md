# HUMANS vs AI

Browser-first competitive puzzle game. This repository is at **milestone M0** (foundation, engine, five specified levels, level-1 visual prototype). See `docs/M0-HANDOVER.md`.

```bash
npm ci
npm run check        # typecheck + lint + unit tests + level solvability + production build
npm run test:e2e     # Playwright (builds and serves the app; needs Chromium)
npm run screenshots  # regenerates docs/design/screenshots
npm run dev --workspace @hva/web   # http://localhost:5173
```

Developer URL switches: `?screen=arena&briefing=0&level=3` jumps straight to a level (levels 2–5 are rendered for review only; the M0 player flow is level 1).

Docs: `docs/product` (master spec, audit) · `docs/design` (levels, design system, screenshots) · `docs/architecture` · `docs/verification`.
