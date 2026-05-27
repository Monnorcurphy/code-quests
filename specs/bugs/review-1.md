# BUG: LoadoutPanel does not move focus into the modal on open

**Severity:** HIGH
**File(s):** packages/client/src/features/armory/loadout-panel.tsx

## Problem

When the Armory loadout modal opens (via Phaser "E" key or `setActiveModal('armory-loadout')`), no `useEffect` moves keyboard focus inside the panel. Focus remains on whatever element triggered the open (typically the Phaser canvas / document body).

Consequences:
1. Screen readers do not announce the dialog because focus never enters it — defeats the purpose of `role="dialog" aria-modal="true"`.
2. The `useFocusTrap` Tab handler only intercepts when `document.activeElement` is the first OR last focusable inside the panel. When focus is outside the panel, neither branch fires, so the trap does nothing on the first Tab press — the user must Tab through any focusable elements outside the modal before reaching it.
3. The acceptance criteria explicitly require: *"Tab cycles columns; Space toggles a row; Enter on the Save button submits; Escape closes the overlay."* Without initial focus, "Tab cycles columns" cannot be relied on as the first action a keyboard user takes.

All other modal panels in this codebase already establish initial focus on mount (see `packages/client/src/features/town-square.tsx:15-22`, `packages/client/src/features/guild/guild-hall.tsx:22-29`, `packages/client/src/features/war-room.tsx`, `packages/client/src/components/coming-soon-panel.tsx:14-16`). LoadoutPanel is the outlier.

## Expected

- `.claude/rules/accessibility.md` rule 1 (keyboard accessible) and rule 10 (screen-reader navigable).
- `.claude/rules/ux-design.md` "Where am I?" — opening a modal must visibly/audibly indicate the user is now operating the dialog.
- Acceptance criteria from `metrics/task-diamond-context.md`: keyboard accessible (Tab cycles columns).
- Pattern consistency with all other panels.

## Fix

Add a mount-only effect that focuses the first focusable element inside the panel, mirroring `town-square.tsx`:

```tsx
useEffect(() => {
  const panel = panelRef.current;
  if (!panel) return;
  const first = panel.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled])',
  );
  first?.focus();
}, [panelRef]);
```

Place it alongside the existing effects in `loadout-panel.tsx` (after the `useFocusTrap(...)` call). Run with empty deps so it only fires on mount — re-renders driven by checkbox toggles must not re-snap focus.

Optionally add a unit test that asserts the first focusable element receives focus after mount (e.g., `expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save Loadout' }))` or similar, depending on which element ends up first in DOM order).
