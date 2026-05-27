# BUG: Escape on cancel confirm dialog also closes the War Room modal

**Severity:** HIGH
**File(s):** `packages/client/src/features/quests/cancel-button.tsx`, `packages/client/src/lib/use-focus-trap.ts`

## Problem

`CancelButton` calls `useFocusTrap(handleAbortCancel)` at the component level. This hook adds a **document-level** keydown listener that fires on every Escape press, regardless of whether the confirm dialog is currently open.

`WarRoom` also calls `useFocusTrap(() => setActiveModal(null))`, registering its own document Escape listener. Because both listeners are attached to `document` (and neither calls `e.stopPropagation()` or `e.preventDefault()`), pressing Escape while the cancel confirm dialog is open causes **both** handlers to fire:

1. WarRoom's handler runs `setActiveModal(null)` → the entire War Room modal closes.
2. CancelButton's handler runs `handleAbortCancel` → tries to set state on a component that is being unmounted.

Net effect: the user opens the cancel confirm dialog, presses Escape expecting to dismiss only the dialog, and the entire War Room modal disappears. This violates the standard "innermost modal handles Escape first" pattern and breaks UX for accessibility users who navigate via keyboard.

Additionally, the Escape handler in `useFocusTrap` is **always** registered while the cancel button is mounted, even when `state === 'idle'`. That means when the quest is active and the user presses Escape to close the War Room, CancelButton's no-op `handleAbortCancel` still fires.

## Expected

Per `rules/domain/frontend/state-management.md` (Focus Management in Modals and Panels) and standard a11y patterns:

- Escape on a nested confirmation dialog should dismiss **only that dialog**, not the parent modal.
- The nested dialog's Escape listener must be active only while the dialog is open.
- The nested handler must prevent the outer handler from firing (via `e.stopPropagation()` / `e.preventDefault()` on the keydown, or by gating registration on `state === 'confirming'`).

## Fix

Pick one of:

**Option A (preferred):** Don't use the shared `useFocusTrap` for the inline confirm panel. Instead, register a dedicated Escape listener inside `cancel-button.tsx` only while `state === 'confirming'`, and call `e.stopPropagation()` so the outer trap doesn't see it:

```tsx
useEffect(() => {
  if (state !== 'confirming') return;
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleAbortCancel();
    }
  }
  document.addEventListener('keydown', onKey, true); // capture, runs before WarRoom's bubble listener
  return () => document.removeEventListener('keydown', onKey, true);
}, [state]);
```

Also implement Tab trapping manually for the confirm panel only while open.

**Option B:** Extend `useFocusTrap` to accept an `active: boolean` argument and bail out of its keydown handler when `active === false`. Pass `state === 'confirming'` from the cancel button. Still need to address the propagation issue (outer trap would still fire on the same Escape).

Add a test that asserts Escape on the confirm dialog leaves the parent War Room intact (i.e. only the dialog dismisses).
