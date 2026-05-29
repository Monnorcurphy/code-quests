# BUG: ShowcaseButton ConfirmModal missing focus management

**Severity:** HIGH
**File(s):** packages/client/src/features/town-square/showcase-button.tsx

## Problem

The `ConfirmModal` component rendered by `ShowcaseButton` declares
`role="dialog"` and `aria-modal="true"`, but it implements none of the
focus-management contract required for modal dialogs in this project:

1. No initial focus is moved into the modal. When the modal mounts, the
   user's focus stays on the "Start Showcase Demo" button beneath it (or
   wherever it was), so keyboard/AT users have no idea a dialog opened
   until they hunt for it.
2. No focus trap. Pressing Tab moves focus out of the dialog and into the
   underlying Town Square panel, contradicting the `aria-modal="true"`
   claim.
3. No Escape-to-dismiss handler. The only way to close the modal is to
   click the Cancel button.
4. No focus restoration. After Cancel or successful confirmation, focus
   is not returned to the "Start Showcase Demo" button that triggered it.
5. It is a destructive confirmation modal ("reset your database"), so per
   `.claude/rules/state-management.md` the safest action (Cancel) must be
   the one that receives initial focus.

## Expected

Per `.claude/rules/state-management.md` §"Focus Management in Modals and
Panels":

> 1. Focus must move to the safest action (Cancel button for destructive confirms)
> 2. Focus must be trapped inside the modal (Tab cycles within, not escaping)
> 3. On dismiss, focus must return to the triggering element
> 4. Focus must NOT re-snap on every parent re-render — use a mount-only effect

And per `.claude/rules/accessibility.md`:

> Every interactive element must be operable via keyboard (Tab, Enter, Escape).

If the dialog truly is `aria-modal="true"`, it MUST behave modally for
keyboard users.

## Fix

In `ConfirmModal`:
1. Add a `useEffect` (mount-only) that moves focus to the Cancel button
   when the modal mounts.
2. Add a `keydown` listener while the modal is open that calls `onCancel`
   when the Escape key is pressed (and is not disabled because of `loading`).
3. Implement a Tab focus trap inside the panel (same pattern as
   `tour-overlay.tsx`).
4. In `ShowcaseButton`, capture a ref to the trigger button. After the
   modal closes (Cancel or success), restore focus to that button.
