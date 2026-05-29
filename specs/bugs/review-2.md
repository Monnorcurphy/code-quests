# BUG: TourOverlay missing arrow-key navigation

**Severity:** HIGH
**File(s):** packages/client/src/features/tour/tour-overlay.tsx

## Problem

The task spec for `eclipse` explicitly requires the tour overlay to
support arrow keys for advance/back navigation:

> `packages/client/src/features/tour/tour-overlay.tsx` — small accessible
> overlay component: focus-trapped, ESC dismisses, **arrow keys
> advance/back**, screen-reader-announced step text via `aria-live`

The current `onKeyDown` handler only handles Escape and Tab:

```ts
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') { exitTour(); return; }
  if (e.key !== 'Tab') return;
  // ... focus trap only
}
```

Pressing ArrowRight or ArrowLeft does nothing.

## Expected

Per the task spec, ArrowRight (and ArrowDown) should advance to the next
step (or call Finish on the last step), and ArrowLeft (and ArrowUp)
should go back one step (no-op on step 1).

## Fix

In the focus-trap effect of `TourOverlayContent`, extend the keydown
handler to also call `nextStep` / `prevStep` on the arrow keys (with the
same isLast handling that `handleNext` already does), and ensure those
key presses don't interfere with the Tab focus trap branch.

Also add unit tests in `tour-overlay.test.tsx` that fire ArrowRight on
step 1 and assert `step === 2`, and ArrowLeft on step 3 and assert
`step === 2`.
