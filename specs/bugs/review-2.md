# BUG: 3-second post-success setTimeout is not cleared on unmount

**Severity:** LOW
**File(s):** `packages/client/src/features/library/coin-monster-type-modal.tsx`

## Problem

In `handleSubmit` (lines 127–130), on a successful create the modal schedules
a bare `setTimeout(..., 3000)` to invoke `onSuccess(...)` and `handleClose()`.
The timer ID is discarded and there is no cleanup `useEffect` that clears it.

During those 3 seconds the modal remains dismissable via the backdrop click
(`onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}`) and
via `Escape` (through `useFocusTrap`). The Cancel button is disabled while
`isSubmitting` is true, but backdrop + Escape are not gated by `isSubmitting`.

If the user dismisses early, the modal unmounts but the timer continues to
fire. When it does:

1. `onSuccess(type.name)` is called on the parent (currently a no-op, but the
   contract is still violated).
2. `handleClose()` calls `triggerRef.current?.focus()` — this re-focuses the
   "+ Coin New Type" button up to 3 seconds after the user moved on, stealing
   focus from whatever they're now interacting with.
3. `handleClose()` then calls `onClose()` again on an already-closed modal —
   harmless `setShowCoinModal(false)`, but unnecessary churn.

The focus-stealing in step 2 is the user-visible bug.

## Expected

Per `rules/state-management.md` ("Event listeners: Store-Level, Not
Component-Level" / cleanup discipline) and React's standard pattern for
async side effects, the pending `setTimeout` must be cleared when the
component unmounts.

## Fix

Store the timer id in a ref and clear it from a cleanup effect. Example:

```tsx
const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (successTimerRef.current !== null) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  };
}, []);

// in handleSubmit, replace setTimeout(...) with:
successTimerRef.current = setTimeout(() => {
  onSuccess(type.name);
  handleClose();
}, 3000);
```

(Alternatively: clear in the existing `handleClose` so an early dismiss
cancels the pending tick.) After the fix, a regression test should mount the
modal, trigger success, unmount the modal before 3 s elapse, then
`vi.advanceTimersByTime(3000)` and assert `mockOnSuccess` was NOT called.
