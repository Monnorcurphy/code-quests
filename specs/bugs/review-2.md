# BUG: Library modal no longer moves focus into the panel on mount

**Severity:** HIGH
**File(s):** `packages/client/src/features/library.tsx`

## Problem

The previous `library.tsx` (now replaced) ran a mount-only effect that moved focus to the first interactive control inside the modal panel:

```tsx
const focusedRef = useRef(false);
useEffect(() => {
  if (focusedRef.current) return;
  const panel = panelRef.current;
  if (!panel) return;
  const first = panel.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
  );
  if (first) { first.focus(); focusedRef.current = true; }
}, [panelRef, quest]);
```

The new `library.tsx` removed this effect. `useFocusTrap` only handles `Tab` cycling and `Escape`; it does NOT move focus on mount. Because the Library Phaser scene auto-opens the modal (`library-scene.ts:47`), the user enters the modal with focus still in the previous focus owner (the Phaser canvas / `body`), so:

- Keyboard-only users must `Tab` blindly into the modal before they can interact with it.
- Screen-reader users don't get the dialog's accessible name (`library-title`) announced, because focus has not entered the dialog.

Every other modal in the codebase (`oracle.tsx`, `tavern.tsx`, `war-room.tsx`, `town-square.tsx`, `hall-of-returns.tsx`, `guild-hall.tsx`, `loadout-panel.tsx`, `dispatch-button.tsx`) does this focus move on mount — Library is now the inconsistent outlier.

## Expected

`rules/state-management.md` (Focus Management in Modals and Panels):

> When a modal, confirmation dialog, or slide-out panel mounts:
> 1. Focus must move to the safest action (Cancel button for destructive confirms)
> 2. Focus must be trapped inside the modal (Tab cycles within, not escaping)
> 3. On dismiss, focus must return to the triggering element
> 4. Focus must NOT re-snap on every parent re-render — use a mount-only effect

The Library is a non-destructive modal, so focus should move to the first focusable element (the active Bestiary tab). This must be mount-only so switching tabs does not re-snap focus away from the user.

## Fix

Add a mount-only effect to `packages/client/src/features/library.tsx` that focuses the first focusable element inside `panelRef`. Pattern from the previous version / `oracle.tsx`:

```tsx
const focusedRef = useRef(false);
useEffect(() => {
  if (focusedRef.current) return;
  const panel = panelRef.current;
  if (!panel) return;
  const first = panel.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
  );
  if (first) { first.focus(); focusedRef.current = true; }
}, [panelRef]);
```

Add an `import { useEffect, useRef, useState } from 'react'` update. Optionally cover with a test that opens Library and asserts `document.activeElement` is the Bestiary tab button.
