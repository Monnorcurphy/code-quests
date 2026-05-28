# BUG: Focus management not verified by tests

**Severity:** LOW
**File(s):** `packages/client/src/features/quest/__tests__/seek-counsel-dialog.test.tsx`

## Problem

Task gale acceptance criteria includes:

> Focus management: dialog traps focus; ESC closes; return focus to "Seek counsel" button on close.

The current test suite verifies:
- textarea focused on mount ✓
- ESC closes ✓

But does NOT verify:
1. Tab cycles from last focusable element back to the first
2. Shift+Tab cycles from the first focusable element back to the last
3. Focus is returned to the trigger element when the dialog unmounts

Worse, the test helper `renderDialog` uses `createRef<HTMLButtonElement>()` without attaching it to a real DOM element, so `triggerRef.current` is `null`. The cleanup branch `trigger?.focus()` is therefore an inert no-op in every existing test, leaving the spec-required focus-return behavior completely untested.

## Expected

Per `.claude/rules/never-skip-review.md` and the gale spec, the focus-trap and focus-return behavior must be tested. Per `.claude/rules/testing.md`, "assertions must be unconditional" — the existing tests do not exercise the codepath at all because the ref is never attached.

## Fix

Add tests to `seek-counsel-dialog.test.tsx`:

1. **Focus trap forward**: render dialog with text in textarea so Mark blocked is enabled. Programmatically focus the last button (Mark blocked) and dispatch a Tab key. Assert focus lands on the textarea.
2. **Focus trap backward**: focus the textarea, dispatch Shift+Tab. Assert focus lands on Mark blocked (or Cancel when submit is disabled).
3. **Focus return on close**: render the dialog with a real `<button>` mounted as the trigger (e.g., render both inside a wrapper), pass its ref via `triggerRef`. Close the dialog (Cancel/ESC/backdrop). Assert `document.activeElement === triggerButton`.
