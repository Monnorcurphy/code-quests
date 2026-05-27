# BUG: Dead key allocations in `KeyboardController`

**Severity:** LOW
**File(s):** packages/client/src/game/input/keyboard-controller.ts

## Problem

`packages/client/src/game/input/keyboard-controller.ts:48-49` allocates more keys than the controller actually consumes:

```ts
this.cursors = scene.input.keyboard!.createCursorKeys() as CursorKeysLike;
const keys = scene.input.keyboard!.addKeys('W,A,D,ENTER,ESC,TAB') as Record<string, KeyLike>;
```

- `createCursorKeys()` allocates `left`, `right`, `up`, `down`, `space`, `shift`. Only `left` and `right` are referenced by `CursorKeysLike` / `update()`.
- `addKeys('W,A,D,ENTER,ESC,TAB')` includes `W`, but the controller never reads `keys['W']`.

`.claude/rules/code-quality.md` rules out dead code: *"No unused imports, variables, or functions — run your linter"* and *"No TODO/FIXME without a linked task — stale TODOs are dead code with extra guilt"*. The allocations don't surface as ESLint errors because they sit inside Phaser's runtime values, but the intent is the same: the references exist with no behavior backing them.

If WASD is supposed to mean W/A/S/D (i.e., W for "up"/"interact"/something else), the behavior is missing. If only A and D are needed for horizontal movement, the W allocation is dead.

## Expected

Either:
- Remove the unused key/cursor allocations.
- Or wire them up to the behavior they were intended for (e.g., W → 'up'/'jump'/etc., space → some action), with corresponding tests.

## Fix

Pick one path:

1. **Trim to what's used:**
   ```ts
   const keys = scene.input.keyboard!.addKeys('A,D,ENTER,ESC,TAB') as Record<string, KeyLike>;
   ```
   And switch `createCursorKeys()` to `addKeys('LEFT,RIGHT')` (or keep cursors but narrow the typing comment so it's clear only horizontal cursors are consumed).

2. **Implement the missing behavior** (e.g., W as another bind for `move-up` if/when vertical movement lands), and add a test that fails today.

Either way, every key that survives the change should have a corresponding `update()` branch and a test.
