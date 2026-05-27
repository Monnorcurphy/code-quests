# BUG: `initialScene` prop on PhaserMount is dead — never drives scene selection
**Severity:** HIGH
**File(s):** packages/client/src/game/phaser-mount.tsx, packages/client/src/game/game-config.ts, packages/client/src/game/scenes/boot-scene.ts

## Problem
The `initialScene` prop is declared on `PhaserMount`, passed through to `getGameConfig`, and lives in the `useEffect` dependency list — but it has no functional effect on which scene starts.

1. `game-config.ts` line 7 renames the parameter to `_initialScene` (underscore prefix → eslint ignored unused) and hardcodes `scene: [BootScene]` regardless of the requested scene.
2. `boot-scene.ts` `create()` only renders text and never invokes `this.scene.start(...)` to transition to the requested scene.
3. `phaser-mount.tsx` line 24 lists `initialScene` in the `useEffect` dependency array. If the prop ever changes, React will tear down and recreate the entire `Phaser.Game` instance for no observable reason (because the value is ignored).

The task spec explicitly requires:
- "`packages/client/src/game/phaser-mount.tsx` … accepts `initialScene` prop"
- "`packages/client/src/game/scenes/boot-scene.ts` — minimal first scene … immediately starts whichever scene is requested"

Right now `initialScene` is a label that promises behavior the code does not deliver. The next task that adds a second scene and passes `<PhaserMount initialScene="forest" />` will silently get the boot scene instead, with no warning. This is the classic "wrong default that escapes review" pattern.

## Expected
- The `initialScene` prop must actually control which scene starts when the Phaser game mounts.
- If `initialScene !== 'boot'`, the boot scene should transition to the requested scene after its initial render (per spec: "immediately starts whichever scene is requested").
- The `useEffect` dependency should only re-create the game when something that actually drives configuration changes.

## Fix
Pick one of the following two paths and apply it end-to-end:

**Option A — wire initialScene through (preferred, matches spec)**
1. In `game-config.ts`, drop the underscore: accept `initialScene: SceneKey` and use the scene registry (`getScene(initialScene)`) to look up the requested constructor. Include `BootScene` first in the `scene` array, followed by the requested scene if different.
2. In `boot-scene.ts`, accept the requested initial scene via Phaser's scene data (`init(data: { next?: SceneKey })`) or via a small module-level setter, and call `this.scene.start(next)` at the end of `create()` when `next !== 'boot'`.
3. Add a unit test that registers a second mock scene, mounts `<PhaserMount initialScene="X" />`, and asserts the registry was consulted with `'X'`.

**Option B — remove the dead API surface until it's needed**
1. Remove the `initialScene` prop from `PhaserMount` and the `_initialScene` parameter from `getGameConfig`.
2. Change the `useEffect` deps to `[]` (mount-once semantics) and update the test to call `<PhaserMount />` without the prop.
3. Update `town.tsx` to drop `initialScene="boot"`.

Either path eliminates the misleading dead parameter and the unnecessary re-mount risk. Option A is the better long-term fix because Phase 2's later tasks will need exactly this plumbing.
