# BUG: Modal effect depends on unstable `onClose` callback

**Severity:** LOW
**File(s):** `packages/client/src/routes/town.tsx`

## Problem

`BuildingModal`'s `useEffect` lists `onClose` in its dependency array:

```tsx
useEffect(() => {
  closeRef.current?.focus();
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [onClose]);
```

`onClose` (=== `handleClose` in `Town`) is a fresh function on every render of `Town`. Today this is harmless because nothing else changes Town's state while the modal is open, but the effect ALSO re-runs `closeRef.current?.focus()` whenever it re-runs — so any future parent re-render while the modal is mounted will silently re-snap focus to the Close button (interrupting screen readers, breaking text selection in the modal body, etc.). This violates the convention in `rules/domain/frontend/state-management-conventions.md`:

> Every effect dependency must be stable across renders.
> Focus must NOT re-snap on every parent re-render — use a mount-only effect.

## Expected

The keydown listener should be installed once on mount and removed on unmount. The focus snap should happen exactly once on mount.

## Fix

Either:
1. Split the effect — a mount-only effect (`[]` deps) for the initial focus, and a separate effect using a ref to hold the latest `onClose`:

```tsx
const onCloseRef = useRef(onClose);
useEffect(() => { onCloseRef.current = onClose; });
useEffect(() => {
  closeRef.current?.focus();
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCloseRef.current();
  }
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

2. Or wrap `handleClose` in `Town` with `useCallback`:

```tsx
const handleClose = useCallback(() => {
  const triggerId = openBuilding;
  setOpenBuilding(null);
  if (triggerId) triggerRefs.current.get(triggerId)?.focus();
}, [openBuilding]);
```

Option 1 is preferred — it makes the modal's behavior independent of the parent's render discipline.
