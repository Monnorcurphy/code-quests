# Progress — Phase 5

Previous task progress archived to metrics/progress-before-arquebus.md

## Task arquebus — BaseQuestScene + 4 quest scene classes

**Status:** Complete

**What was done:**
- Extended `SceneKey` union in `scene-registry.ts` with 4 quest keys; added `QUEST_SCENE_KEYS`, `QuestSceneKey` type, `isQuestSceneKey()` predicate
- Added `SceneAdvanceEvent`, `requestSceneAdvance()`, `onSceneAdvance()` to `scene-router.ts` (mirrors door-enter pattern)
- Created `base-quest-scene.ts`: abstract Phaser.Scene subclass with tileSprite background + ground, Player, KeyboardController, right-edge debounced advance trigger, prefers-reduced-motion fade
- Created 4 concrete scenes: `quest-forest-scene.ts`, `quest-cave-scene.ts`, `quest-dungeon-scene.ts`, `quest-boss-room-scene.ts` — each ≤ 30 lines; boss-room has nextSceneKey=null
- Registered all 4 scenes in `game-config.ts` via side-effect imports
- Tests: `quest-scenes.test.ts` (key assertions, nextSceneKey chain, edge trigger, debounce, boss-room terminal); scene-registry tests for new predicates; scene-router tests for new advance methods
- All 360 tests pass, typecheck clean, lint clean, build succeeds
