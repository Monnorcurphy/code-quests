# BUG: onClose and backdrop onClick callbacks not memoized

**Severity:** LOW
**File(s):** `packages/client/src/features/quest/block-controls.tsx`, `packages/client/src/features/quest/seek-counsel-dialog.tsx`

## Problem

`BlockControls` passes `onClose={() => setDialogOpen(false)}` as an inline arrow function to `SeekCounselDialog` (block-controls.tsx:101). Because the HUD overlay re-renders on every WebSocket-driven status/encounter update, `BlockControls` re-renders on every parent re-render, producing a fresh `onClose` reference each time.

Inside `SeekCounselDialog`, the keydown effect has `[onClose]` as its dependency array (seek-counsel-dialog.tsx:48). The new `onClose` reference causes the effect to detach and re-attach the document-level `keydown` listener on every parent re-render. The backdrop `onClick` handler in seek-counsel-dialog.tsx:77 is also a fresh closure per render.

Per `.claude/rules/state-management.md`:

> Every effect dependency must be stable across renders. Unstable dependencies (inline callbacks, new object refs) cause re-runs that leak resources, re-snap focus, or stack event listeners.
>
> Rules:
> 1. Callback props passed to children: wrap with `useCallback` (React) or equivalent

## Expected

`onClose` should be stable across renders so the keydown effect attaches once on dialog mount and detaches once on unmount.

## Fix

In `block-controls.tsx`, wrap the close handler with `useCallback`:

```ts
const handleDialogClose = useCallback(() => setDialogOpen(false), []);
// ...
<SeekCounselDialog questId={questId} triggerRef={seekCounselBtnRef} onClose={handleDialogClose} />
```

(Optional polish) In `seek-counsel-dialog.tsx`, also memoize the backdrop click handler so it doesn't churn on each render.
