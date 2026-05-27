# BUG: Dead `controller.on('back')` listener in TownSquareScene

**Severity:** LOW
**File(s):** `packages/client/src/game/scenes/town-square-scene.ts`

## Problem

`town-square-scene.ts:93-95` registers a controller listener for the `'back'` event (Esc key):

```ts
this.controller.on('back', () => {
  useTownStore.getState().setActiveModal(null);
});
```

This listener is effectively dead:

1. When `activeModal !== null`, `update()` returns early (line 103) and never calls `controller.update()`. The controller cannot emit any event, including `'back'`.
2. When `activeModal === null`, the listener fires `setActiveModal(null)` — which is a no-op because the modal is already null.

The user-visible "Esc closes the modal" behavior actually works through React's `useFocusTrap` (`use-focus-trap.ts:14-22`), which listens on `document` and survives regardless of the Phaser update loop. The controller listener contributes nothing.

This is dead code that misleads future readers into thinking the Phaser side is responsible for closing the modal.

## Expected

Per `.claude/rules/common-findings.md` (#4 Dead code) and the code-quality "Dead code" rule: no unused logic in production code.

Either remove the listener, or make it functional by also updating the controller state while modal is open (so it can react to Esc).

## Fix

Remove lines 93-95:

```ts
// Delete this block:
this.controller.on('back', () => {
  useTownStore.getState().setActiveModal(null);
});
```

The React focus trap already handles Escape-to-close, so no replacement is needed.
