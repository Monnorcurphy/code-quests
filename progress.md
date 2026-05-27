# Progress — Phase 2

Previous task progress archived to metrics/progress-before-alpaca.md

## Task alpaca: Phaser 3 integration + scene manager

**Status:** Complete

- Installed `phaser@^3` (3.90.0) in `packages/client`
- Created `src/game/scene-registry.ts` — typed registry with `SceneKey = 'boot'` union, `registerScene`, `getScene`, `getSceneList`
- Created `src/game/scenes/boot-scene.ts` — extends `Phaser.Scene`, renders "Code Quests" centered text on `#f0e6d2` parchment background, auto-registers via `registerScene`
- Created `src/game/game-config.ts` — 1280×720, `Phaser.Scale.FIT`, `pixelArt: true`, transparent canvas
- Created `src/game/phaser-mount.tsx` — React component wrapping `Phaser.Game`, creates on mount and destroys on unmount
- Created `src/stores/town-store.ts` — Zustand store with `currentScene`, `playerX`, `activeModal`, `setScene`
- Modified `src/routes/town.tsx` — feature flag `VITE_PHASER_TOWN !== 'false'` gates Phaser; lazy-loaded via `React.lazy()` to prevent Phaser loading in jsdom tests
- Added `src/vite-env.d.ts` — Vite client types + `VITE_PHASER_TOWN` env var declaration
- Updated `vitest.config.ts` — `define` sets `VITE_PHASER_TOWN='false'` for all unit tests
- Updated `playwright.config.ts` — E2E dev server uses `VITE_PHASER_TOWN=false` to preserve Phase 1 HTML town tests
- Created `src/game/__tests__/scene-registry.test.ts` — unit tests for register/get/overwrite
- Created `src/game/__tests__/phaser-mount.test.tsx` — smoke tests with Phaser mocked via `vi.hoisted` + `vi.mock`
- All 54 tests pass; typecheck, lint, and build all clean
