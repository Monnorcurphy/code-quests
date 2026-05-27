# Progress — Phase 5

Previous task progress archived to metrics/progress-before-cestus.md

## cestus — /quest/:questId route + Phaser quest mount + HUD overlay

### Completed
- Added `/quest/:questId` React route (`packages/client/src/routes/quest.tsx`): fetches quest via TanStack Query, mounts PhaserMount with `initialScene = quest.currentScene`, shows loading/empty/error states, wires `sceneRouter.onSceneAdvance` to `POST /quests/:id/advance-scene`.
- Created `HUDOverlay` component (`packages/client/src/features/quest/hud-overlay.tsx`): top banner with quest title + adventurer name (fetched via TanStack Query), status badge, Return-to-Town button, parchment log placeholder, advance-scene feedback strip (loading + persistent error).
- Added `POST /quests/:id/advance-scene` endpoint to server (`packages/server/src/routes/quests.ts`): validates `expectedFrom` against `current_scene`, calls `advanceQuestScene`, emits `scene_change` AgentEvent through quest channel, returns 409 on mismatch / 401 if no active agent / 200 with `advanced: false` at terminal scene.
- Registered `/quest/:questId` route in `packages/client/src/app.tsx`.
- Added `api.adventurers.get`, `api.quests.advanceScene`, and `AdvanceSceneResponseSchema` to `packages/client/src/lib/api.ts`. Also fixed `fetchJson/postJson/patchJson` to use `z.output<S>` for correct TypeScript output-type inference.
- Tests: `packages/client/src/__tests__/quest-route.test.tsx` (10 tests) + `packages/server/src/__tests__/quests-advance-scene.test.ts` (11 tests). All 370 client + 234 server tests green.
- Typecheck, lint, build all pass.
