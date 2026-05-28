# Progress — Phase 6

Previous task progress archived to metrics/progress-before-carmania.md

## carmania — Client monster store + asset loader extension

- Created `packages/client/src/stores/encounter-store.ts` — Zustand store with `byQuest`, `handleAgentEvent`, and `clearQuest`. Handles `monster_appeared` (hp=100, outcome=pending), `combat` (decrement hp by 25, clamped ≥0), `monster_resolved` (set outcome). 18 tests, all pass.
- Created `packages/client/src/stores/__tests__/encounter-store.test.ts` — full coverage of all event paths, HP clamping, isolation between quests, clearQuest.
- Updated `packages/client/src/features/quest/use-quest-stream.ts` — calls `useEncounterStore.getState().handleAgentEvent(questId, event)` for every incoming event.
- Updated `packages/client/src/features/quest/__tests__/use-quest-stream.test.tsx` — added encounter store mock and 3 new tests verifying integration.
- Updated `packages/client/src/game/asset-loader.ts` — added `MONSTER_SPRITE_PATHS`, `monsterTypeIdToAssetKey` (all 10 built-in IDs), and `preloadMonsterAssets(scene)` function.
- Created `packages/client/src/game/__tests__/asset-loader-monsters.test.ts` — 19 tests covering all 10 keys, path format, and specific mappings.
- Updated `packages/client/src/game/scenes/base-quest-scene.ts` — `preload()` now calls `preloadMonsterAssets(this)` alongside `preloadQuestAssets(this)`.
- Fixed `packages/client/src/game/scenes/__tests__/quest-scenes.test.ts` — added `preloadMonsterAssets: vi.fn()` to the asset-loader mock.
- All 466 client tests pass, typecheck clean, lint clean.
