# Progress — Phase 2

Previous task progress archived to metrics/progress-before-cobra.md

## cobra — Player avatar + keyboard movement

**Status:** Done

**What was built:**
- `packages/client/src/game/entities/player.ts` — `Player` class with sprite, velocity-based movement, bounds clamping, animation switching (idle/walk), flipX for facing direction, `getX()`, `setX()`, `onInteract()`. Uses `import.meta.env` via optional chaining for `prefers-reduced-motion`.
- `packages/client/src/game/input/keyboard-controller.ts` — `KeyboardController` wrapping Phaser's keyboard API. Emits `move-left`, `move-right`, `stop`, `interact`, `back`, `tab-next`. One-shot events (interact/back/tab) use prev-state tracking to prevent repeat fires on hold. `reducedMotion` exposed as property.
- `packages/client/src/game/scenes/test-scene.ts` — DEV-only debug scene (flat ground, Player, KeyboardController wired together). Syncs player position + facing to `useTownStore`. Registered only when `import.meta.env.DEV`.
- `packages/client/src/stores/town-store.ts` — extended with `facing: 'left' | 'right'`, `setPlayerX()`, `setFacing()` actions.

**Tests:** 30 new tests (17 player + 13 keyboard-controller), all passing. Total 155 tests across monorepo.
