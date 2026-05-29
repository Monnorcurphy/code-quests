# Progress — Phase 11

Previous task progress archived to metrics/progress-before-eclipse.md

## Task eclipse — Capstone: "Start Showcase Demo" button + full E2E

**Status:** Complete

### What was built

**Server:**
- `packages/server/src/agents/stub-adapter.ts` — deterministic stub `AgentAdapter` for demo mode. Per-quest event sequences: copy quest (Grognak → defeated → completed), meter quest (Imp → defeated → completed), JWT quest (PAUSED_INPUT → Imps escalate to Lich → failed), JWT v2 repost (clean completed). Activated via `CODE_QUESTS_ENV=demo` in `select-adapter.ts`.
- `packages/server/src/agents/select-adapter.ts` — wires stub adapter when `CODE_QUESTS_ENV=demo`.
- `packages/server/src/agents/__tests__/stub-adapter.test.ts` — 15 tests covering all quest sequences, PAUSED_INPUT/respond, cancel, and the production guardrail that stub is NOT used outside demo mode.

**Client:**
- `packages/client/src/stores/tour-store.ts` — Zustand store for tour state (active, step, totalSteps, navigation actions).
- `packages/client/src/features/tour/showcase-steps.ts` — 12 step definitions (route, title, body, anchor selector) for the showcase walkthrough.
- `packages/client/src/features/tour/tour-overlay.tsx` — Accessible overlay (focus-trapped, ESC dismisses, aria-live, role=dialog/aria-modal). Rendered at app root via React portal. Navigates to correct route at each step.
- `packages/client/src/features/town-square/showcase-button.tsx` — Demo-mode-only button (hidden in production). Shows confirmation modal → POST /showcase/reset → starts tour.
- `packages/client/src/app.tsx` — TourOverlay added at app root so it survives navigation.
- `packages/client/src/main.tsx` — `__tourStore` exposed on `window` for E2E tests.
- `packages/client/index.html` — `#tour-portal` div added for React portal target.
- `packages/client/vite.config.ts` — `/showcase` proxy added; `VITE_CODE_QUESTS_ENV` baked in from `CODE_QUESTS_ENV` at startup.
- `packages/client/src/lib/api.ts` — `api.showcase.reset()` added.
- `packages/client/src/styles/features.css` — Tour overlay and showcase button CSS added.
- Unit tests: tour-store (8), tour-overlay (11), showcase-button (6).
- `packages/client/tests/e2e/phase-11-capstone.spec.ts` — 6 Playwright E2E tests including full 12-step advance, ESC dismiss, Back button, 403 error display, hidden in non-demo mode, and Hall of Returns completion view. Axe-core scans at steps 1, 4, 7, 12.

### Test results
- Server: 566 tests, 41 files — all pass
- Client unit: 1020 tests, 72 files — all pass
- Build: clean (client + server)
