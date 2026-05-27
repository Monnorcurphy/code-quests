# Progress — Phase 2

Previous task progress archived to metrics/progress-before-deer.md

## Task deer — Scene routing, transitions, and player state persistence

**Status:** Complete

**What was built:**
- `packages/client/src/game/scene-registry.ts` — Added 8 town scene keys + `isTownSceneKey` guard + `TOWN_SCENE_KEYS` array
- `packages/client/src/game/scene-router.ts` — `SceneRouter` singleton: `goToScene(key, opts?)` with 300ms fade (0ms under reduced-motion), `emitDoorEnter`/`onDoorEnter` for React↔Phaser bridge
- `packages/client/src/game/entities/door.ts` — `Door` class: proximity detection (60px radius), gold outline highlight when in range, `tryEnter()` emits door event
- `packages/client/src/game/scenes/base-town-scene.ts` — Abstract `BaseTownScene` Phaser scene: parchment background, ground, player spawn via `init()` data, door wiring, controller, fade-in on create
- `packages/client/src/game/phaser-mount.tsx` — Updated to register game with `sceneRouter.init()` on mount, use stable initial scene ref (no game recreation on URL changes)
- `packages/client/src/routes/town.tsx` — Split into `HtmlTown` (test mode) and `PhaserTown` (Phaser mode); Phaser mode reads `/town/:sceneKey` from URL, listens for door-enter events → pushes to history, calls `goToScene` on URL changes
- `packages/client/src/app.tsx` — Added `/town/:sceneKey` route
- `packages/client/src/components/scene-keyboard-nav.tsx` — Visually-hidden but tabbable nav mirroring scene interactives for screen reader access

**Tests added:**
- `scene-router.test.ts` — 9 tests: fade/instant transitions, reduced-motion, spawn-point passing, door-enter pub/sub
- `entities/__tests__/door.test.ts` — 6 tests: proximity detection, tryEnter guard, label/x exposure
- `components/__tests__/scene-keyboard-nav.test.tsx` — 7 tests: render, click, Enter key, Tab order, visually-hidden style

**Verify result:** 111 tests pass, typecheck clean, lint clean
