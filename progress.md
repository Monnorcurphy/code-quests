# Progress — Phase 5

Previous task progress archived to metrics/progress-before-estoc.md

## Task estoc — WebSocket subscription + live event-to-scene wiring

**Status:** Complete

**Deliverables:**
- `packages/client/src/lib/quest-socket.ts` — added `connectQuestSocket` (callback API with `onEvent`, `onConnectionChange`, `onParseError`); 1s/30s backoff per spec. Updated `logger.ts` to suppress in production builds.
- `packages/client/src/stores/quest-store.ts` — Zustand store with `entriesByQuest` (200-entry cap), `currentSceneByQuest`, `statusByQuest`. Actions: `appendEvent`, `setCurrentScene`, `setStatus`, `reset`.
- `packages/client/src/features/quest/use-quest-stream.ts` — hook opens socket via `connectQuestSocket`, dispatches events to store, calls `sceneRouter.goToScene` on `scene_change`, updates status on `status_change`. Returns `{ status, parseError }`.
- `packages/client/src/features/quest/combat-log.tsx` — log component reads from store, auto-scrolls, `aria-live="polite"`, 200-entry cap enforced.
- `packages/client/src/features/quest/hud-overlay.tsx` — replaced placeholder with `CombatLog`, added connection status chip, status badge reads from store (fallback to server status).
- `packages/client/src/routes/quest.tsx` — calls `useQuestStream`, passes `connectionStatus`/`parseError` to HUD.

**Tests added:**
- `quest-socket.test.ts` — 8 new tests for `connectQuestSocket` (status callbacks, parse errors, backoff cap at 30s)
- `stores/__tests__/quest-store.test.ts` — 10 tests (append, cap, scene/status setters, reset, multi-quest isolation)
- `features/quest/__tests__/use-quest-stream.test.tsx` — 8 tests (status changes, store dispatch, sceneRouter calls, parseError, questId change)

**Verification:** 400 tests pass, typecheck clean, lint clean.
