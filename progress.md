# Progress — Phase 1

Previous task progress archived to metrics/progress-before-bodiam.md

## Task bodiam — React HUD skeleton

**Status:** Complete

**What was built:**
- Installed TanStack Query, react-router-dom, Zustand, and zod in `@code-quests/client`
- `packages/client/src/lib/query-client.ts` — QueryClient with 30s stale time, 1 retry
- `packages/client/src/lib/api.ts` — typed fetch wrappers for adventurers, quests, epics using shared Zod schemas
- `packages/client/src/styles/global.css` — medieval theme (parchment off-white, stone gray, banner-red); all contrast ≥ 4.5:1
- `packages/client/src/routes/town.tsx` — 8 building panels, placeholder modal per building, keyboard nav (Tab/Enter/Escape), ARIA dialog
- `packages/client/src/app.tsx` — react-router Routes; `/town` default, wildcard redirects
- `packages/client/src/main.tsx` — QueryClientProvider + BrowserRouter
- `packages/client/src/__tests__/town.test.tsx` — 9 tests covering render, modal open/close, keyboard, ARIA
- `packages/client/src/app.test.tsx` — 3 tests updated for routing structure

**Verification:** 12 client + 67 server tests passing, typecheck clean, lint clean, vite build succeeds.

---

Previous balmoral entry below:

## balmoral — Express API CRUD endpoints

- Restored ashford source files (deleted by metrics commit c1c8b8a) via git checkout
- Created `packages/server/src/middleware/validate.ts` — Zod body validator, field-named errors
- Created `packages/server/src/middleware/errors.ts` — structured 500 error handler
- Created `packages/server/src/routes/adventurers.ts` — full CRUD router factory
- Created `packages/server/src/routes/epics.ts` — full CRUD router factory
- Created `packages/server/src/routes/quests.ts` — full CRUD router factory with AC lock check
- Updated `packages/server/src/index.ts` — wires routes + middleware, port defaults to 4001
- Created integration tests for all three route sets (61 tests total across 5 test files)
- Added `zod` and `supertest` to server dependencies
- All tests pass, lint clean, typecheck clean
