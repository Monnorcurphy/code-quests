# Progress — Phase 11

Previous task progress archived to metrics/progress-before-earth-sign.md

## task: earth-sign (walkthrough docs)

- Created `specs/done/phase-11-walkthrough.md` — 12-step prose narrative with screenshot references (228 lines)
- Created `packages/client/tests/e2e/capture-walkthrough.spec.ts` — Playwright spec that mocks API calls and produces 12 PNGs deterministically under `assets/screenshots/phase-11/`
- Created `assets/screenshots/phase-11/` directory (PNGs generated on `pnpm test:e2e --grep "Showcase walkthrough"`)
- Updated `README.md` — added "Showcase Demo (Phase 11)" section with launch command and 12-step summary
- Updated `assets/CREDITS.md` — added Phase 10 and Phase 11 no-new-assets notes to complete the license audit
- Updated `packages/client/src/main.tsx` — expose `__questStore` and `__encounterStore` on `window` in DEV mode (same pattern as existing `__townStore`; enables store injection in the capture spec)
- All unit tests pass (995/995), typecheck clean, ESLint clean
