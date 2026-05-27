# Progress — Phase 4

Previous task progress archived to metrics/progress-before-galle.md

## TASK galle — Hall of Returns view + failure summaries

**Status:** Complete

**What was done:**
- Added `004_agent_events.sql` migration — persists events_json on agents table
- Updated `quest-runner.ts` to accumulate AgentEvents and persist them on quest completion/failure
- Added `GET /quests/returned` endpoint (before `/:id` to avoid routing conflict) — joins quests with most-recent agent + adventurer, returns paginated `{ items, total, limit, offset }`
- Added `ReturnedQuest`, `ReturnedAgent`, `ReturnedAdventurer` types + schemas to `api.ts` (manual TS types to work around Zod v3.25 `addQuestionMarks` inference bug); added `api.quests.returned()`
- Added `'hall-of-returns'` to `activeModal` type union in `town-store.ts`
- Updated `hall-of-returns-scene.ts`: `setActiveModal('coming-soon')` → `setActiveModal('hall-of-returns')`
- Added `HallOfReturns` panel to `hud-overlay-manager.tsx`, removed hall-of-returns from COMING_SOON_CONTENT
- New `features/hall-of-returns.tsx` — two-column view (Victorious / Returned in Defeat), card per quest, click-to-detail, loading/error/empty states, useFocusTrap, role=dialog
- New `features/quests/returned-quest-detail.tsx` — full combat log, failure summary alert, "Coming in Phase 9" note (no no-op Re-post/Retire buttons)
- CSS in `features.css` — grid layout, reduced-motion support, outcome badges (text + CSS class, not color alone)
- New `__tests__/hall-of-returns.test.tsx` — 16 tests covering all states, accessibility, interaction
- Added `GET /quests/returned` tests to `packages/server/src/__tests__/quests.test.ts` (8 tests)
- Updated `all-buildings.test.ts`, `hud-overlay-manager.test.tsx`, `town.test.tsx` to reflect new hall-of-returns wiring

**Verify results:** 321/321 client tests pass, 5/5 server tests pass, typecheck clean, lint clean
