# Progress — Phase 9

Previous task progress archived to metrics/progress-before-cedar.md

## cedar — Hall of Returns view + returned-quest list (frontend)

**Status:** DONE

**What was built:**
- `packages/client/src/features/hall-of-returns/hall-of-returns.tsx` — modal view with two tabs (Returned/Completed); tab state preserved as URL query param (`?tab=...`)
- `packages/client/src/features/hall-of-returns/returned-quest-list.tsx` — list component with loading skeleton (3 rows), error banner + retry button, empty state, and quest rows (title, adventurer, fatal monster sprite+name, relative time, recommendation badge)
- `packages/client/src/features/hall-of-returns/use-returned-quests.ts` — TanStack Query hook calling `GET /hall-of-returns/quests`; subscribes to quest WS channels for real-time invalidation
- `packages/client/src/features/hall-of-returns/__tests__/returned-quest-list.test.tsx` — 12 tests covering render, empty state, error state, click navigation, keyboard navigation, edge cases
- `packages/client/src/lib/api.ts` — added `api.hallOfReturns.listQuests()`, `HallOfReturnsQuest`, `HallOfReturnsList` types
- `packages/client/src/features/hall-of-returns.tsx` — re-exports from new folder (keeps old import path working)
- `packages/client/src/components/hud-overlay-manager.tsx` — updated import to new explicit path
- `packages/client/src/app.tsx` — added `/hall-of-returns/:questId` placeholder route (redirects back to town until TASK ebony implements post-mortem)
- `packages/client/src/__tests__/hall-of-returns.test.tsx` — updated tests for new component (13 tests; old Phase 2 tests removed/replaced)

**All tests pass:** 825 client tests, 470 server tests, 83 shared tests. Typecheck + lint clean.
