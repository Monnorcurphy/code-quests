# BUG: ActionBar toast `setTimeout` is never cleared

**Severity:** LOW
**File(s):** `packages/client/src/features/hall-of-returns/actions/action-bar.tsx`

## Problem

```ts
function showToast(msg: string) {
  setToast(msg);
  setTimeout(() => setToast(null), 4000);
}
```

The timer ID isn't stored and the effect/handler has no cleanup. Two real consequences:

1. **Unmount race**: if the user navigates away from the post-mortem within 4 s of a successful action, the timer still fires `setToast(null)` on an unmounted component. React 18 swallows the warning, but the pattern is a latent leak and breaks the rule "Long-running background tasks: use store-level event listeners, NOT component lifecycle hooks. Listeners must survive navigation between pages." For component-local timers, at minimum clean them up.
2. **Stacking**: if two actions complete close together (e.g. user dismisses one then triggers another), the second `showToast` schedules a new timer that will null out the *current* toast 4 s after the second call — and so on. There's a window where the visible toast text and the dismiss timer disagree.

## Expected

Per `rules/ux-feedback.md` ("Success confirmations auto-dismiss after 3-5 seconds using CSS transitions or timers") combined with state-management hygiene: timers must be cancelled when the component unmounts or when a new toast supersedes the old one.

## Fix

Track the timer in a ref and clear it on each new toast and on unmount:

```tsx
const toastTimerRef = useRef<number | null>(null);

function showToast(msg: string) {
  if (toastTimerRef.current !== null) {
    window.clearTimeout(toastTimerRef.current);
  }
  setToast(msg);
  toastTimerRef.current = window.setTimeout(() => {
    setToast(null);
    toastTimerRef.current = null;
  }, 4000);
}

useEffect(() => {
  return () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
  };
}, []);
```

Add a test that unmounts the component before the 4 s elapses and asserts no `setToast` is called afterwards (or that `clearTimeout` was invoked).
