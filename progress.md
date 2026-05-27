# Progress — Phase 4

Previous task progress archived to metrics/progress-before-el-morro.md

## Task el-morro: Active-quest HUD + real-time stream — DONE

**Files created:**
- `packages/client/src/features/quests/use-active-quest.ts` — TanStack Query + WS subscription merged via useReducer; invalidates quest + quests queries on status events
- `packages/client/src/features/quests/active-quest-panel.tsx` — live event feed with aria-live="polite", auto-scroll with reduced-motion support, completion/failure banners from quest data
- `packages/client/src/features/quests/cancel-button.tsx` — three-state cancel (idle/loading/success/error) with inline parchment confirmation dialog
- `packages/client/src/__tests__/active-quest-panel.test.tsx` — 13 tests: feed rendering, accessibility, event types, query invalidation
- `packages/client/src/__tests__/cancel-button.test.tsx` — 9 tests: happy path, error path, confirmation flow, focus management

**Files modified:**
- `packages/client/src/lib/api.ts` — added `quests.active` (GET /quests/active) and `quests.cancel` (POST /quests/:id/cancel)
- `packages/client/src/stores/town-store.ts` — added `goToHallOfReturns()` action
- `packages/client/src/features/war-room.tsx` — conditional rendering: active quest shows ActiveQuestPanel + CancelButton; complete/failed shows "Return to Hall of Returns" link; idle shows existing audit panel
- `packages/client/src/features/town-square.tsx` — replaced ActiveQuestBadge with ActiveQuestsPeek (title, adventurer name, last WS event per quest); uses per-quest WS subscriptions

**Test results:** 301/301 client tests pass, lint clean, typecheck clean
