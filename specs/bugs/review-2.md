# BUG: Bypass-confirm panel does not manage focus — accessibility regression

**Severity:** HIGH
**File(s):** packages/client/src/features/quests/dispatch-button.tsx

## Problem

When the user clicks "Dispatch anyway", `handleDispatchAnyway()` (line 68) sets `showBypassConfirm=true`. This unmounts the "Dispatch anyway" button (its surrounding `<div className="dispatch-blocked">` is removed because of `blockAudit && !showBypassConfirm`) and mounts the `<div className="dispatch-confirm-panel" role="alertdialog" …>` block.

The triggering element no longer exists, so the browser drops focus to `document.body`. None of the rules from `rules/domain/frontend/state-management.md` ("Focus Management in Modals and Panels") are honored:

1. Focus is NOT moved to the safest action (the "Cancel" button) on mount. The dialog is a destructive confirmation — Cancel should receive initial focus.
2. Focus is NOT trapped inside the alertdialog. Tabbing escapes to whatever the War Room focus trap exposes.
3. On dismiss (Cancel or after Confirm), focus is NOT returned to the triggering "Dispatch anyway" button. Keyboard users lose their place entirely.

The `role="alertdialog"` ARIA role is also paired with `aria-modal="false"` (line 142), which actively misrepresents the dialog's behavior to assistive tech. An alertdialog is by definition modal; this combination is contradictory.

This is a real keyboard-and-screen-reader regression — a sighted mouse user can still complete the flow, but a keyboard or screen-reader user has no reliable way to interact with the bypass confirmation.

## Expected

Per `rules/domain/frontend/state-management.md` ("Focus Management in Modals and Panels") and `rules/domain/frontend/accessibility.md` (#1 keyboard accessible, #10 screen reader):

1. When the bypass-confirm panel mounts, focus must move to the "Cancel" button (the safe action for a destructive confirm).
2. Focus must remain inside the panel while it is open (or the surrounding War Room trap must still be effective for both buttons).
3. On dismiss — whether via Cancel, Confirm, or the countdown completing into a Confirm — focus must return to a sensible spot (the original "Dispatch anyway" button, or the main "Dispatch quest" button after a successful re-attempt).
4. Either remove `role="alertdialog"`/`aria-modal` or set `aria-modal="true"` and add a real focus trap.

## Fix

In `dispatch-button.tsx`:

1. Add a `ref` for the Cancel button. In a `useEffect` keyed on `showBypassConfirm` becoming `true`, call `cancelBtnRef.current?.focus()`.
2. Add a `ref` for the "Dispatch anyway" trigger button. On dismissing the panel (`handleCancelBypass`, or once `handleConfirmBypass` settles), call `.focus()` on the appropriate fallback element.
3. Either reuse the existing `useFocusTrap` helper (see `packages/client/src/lib/use-focus-trap.ts`) to trap focus inside `.dispatch-confirm-panel`, or change `role` to a non-modal pattern (e.g., `role="region"` with `aria-labelledby`) and rely on the War Room's outer focus trap.
4. Add a Vitest assertion that after the user clicks "Dispatch anyway", `document.activeElement` is the Cancel button.
