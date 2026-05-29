# BUG: TourOverlay declares aria-modal="true" but does not block underlying interaction

**Severity:** HIGH
**File(s):** packages/client/src/features/tour/tour-overlay.tsx,
packages/client/src/styles/features.css

## Problem

`TourOverlay` is rendered with `role="dialog"` and `aria-modal="true"`,
but its CSS sets `pointer-events: none` on the backdrop:

```css
.tour-overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  ...
  pointer-events: none;
}
.tour-overlay-panel { pointer-events: all; }
```

This produces a contradiction:

- Assistive-tech users (screen readers, keyboard navigation guided by
  ARIA) are told this is a **modal dialog**, which per the ARIA spec
  means nodes outside the dialog are inert and inaccessible.
- Mouse users and Tab-key users can actually still interact with the
  Town/Quest screen behind the overlay — the focus trap in the keydown
  handler only fires when `document.activeElement` is already the first
  or last focusable element *inside* the panel; if focus has moved to
  the underlying app (which it can, because nothing prevents it),
  Tab/Shift+Tab cycles through underlying elements freely.

Either the dialog is modal, or it isn't. The current implementation
lies to assistive tech.

## Expected

Per `.claude/rules/accessibility.md`:
> Use where semantic HTML isn't enough: aria-label, aria-current,
> aria-live. ARIA supplements, not replaces, semantic HTML.

ARIA semantics must match actual behavior. Two acceptable resolutions:

A. **Make the overlay truly modal:** keep `aria-modal="true"`, remove
   `pointer-events: none` on the backdrop (or move it to a transparent
   inert overlay), and explicitly block clicks from reaching the
   underlying app. The focus trap should then start by focusing inside
   the panel on mount and refuse to release focus.

B. **Stop claiming modal:** if the tour is meant to coexist with the
   underlying UI (so the user can click Dispatch etc. while reading the
   step), then drop `role="dialog"` / `aria-modal="true"` and use
   `role="region"` (or `role="complementary"`) with an `aria-label`,
   plus an `aria-live="polite"` region for the step text (which is
   already in place).

## Fix

Pick A or B. Given the task spec describes a narrative walkthrough
where users are expected to interact with the actual UI ("the user
actually clicks Dispatch, picks JWT library at PAUSED_INPUT, equips
type_whisperer at re-post"), option B more accurately matches intended
behavior. In that case:

1. Change `role="dialog"` to `role="region"` and add `aria-label="Tour:
   Step ${step} of ${totalSteps}"`.
2. Remove `aria-modal="true"`.
3. Keep the `aria-live="polite"` block around the title/body so step
   changes are announced.
4. Drop the Tab focus trap (it doesn't make sense for a non-modal
   region) and keep just the Escape-to-exit handler.
