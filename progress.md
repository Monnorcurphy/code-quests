# Progress — Phase 6

Previous task progress archived to metrics/progress-before-intrepid.md

## Task intrepid — Combat surface in the Quest scene

**Status:** Complete

**What was built:**
- `src/game/hp-bar.ts` — standalone `HpBar` Phaser graphics class (bg + fg rects, color-coded by ratio, reducedMotion-aware)
- `src/game/combat-layer.ts` — `CombatLayer` class: subscribes to encounter store, spawns `MonsterSprite` on `monster_appeared`, calls `setHp` on `combat`, plays outcome animation on `monster_resolved`
- Refactored `src/game/entities/monster-sprite.ts` to use `HpBar` (removed inlined HP bar drawing)
- Refactored `src/game/scenes/base-quest-scene.ts` to use `CombatLayer` (removed ~60 lines of inlined encounter logic)
- `src/features/quest/use-quest-stream.ts` — added reconnect re-hydration: on WS reconnect, calls `GET /quests/:questId/encounters` and resolves any pending encounter whose outcome was determined while offline
- `src/__tests__/combat-layer.test.ts` — 17 tests: construction, monster spawning, HP updates, all three outcome animations, onComplete callback, duplicate-animation guard, destroy/unsubscribe, isolation between quest IDs, memory invariant (store size stays bounded after 50 cycles)
- `src/__tests__/combat-log.test.tsx` — 18 tests: empty state, accessibility (role, aria-live, aria-label, aria-atomic), all event types (progress/combat/log/completed/failed), filtering (scene_change excluded), auto-scroll on entry arrival, sticky-scroll pause when user scrolls up, auto-scroll resume when user returns to bottom, timestamp formatting

**Tests:** 546 passed, 0 failed
**Typecheck:** clean
**Lint:** clean
