# BUG: Missing aria-live loading state announcement in RecruitModal

**Severity:** HIGH
**File(s):** `packages/client/src/features/guild/recruit-modal.tsx`

## Problem

The loading state (when the recruit form is submitting) is not announced to screen readers via an `aria-live` region. The implementation uses `aria-busy="true"` on the submit button and changes button text to "Recruiting…", but:

1. `aria-busy` on a `<button>` element is not a valid ARIA pattern — `aria-busy` is defined for containers (regions, forms, etc.), not interactive controls.
2. A disabled button's text change is not reliably announced by screen readers because disabled elements are typically not in the accessibility tree's live-update path.

## Expected

`rules/ux-feedback.md` requires: "All loading states must be announced to screen readers via `aria-live="polite"` regions."

## Fix

Add a visually-hidden `aria-live="polite"` status region adjacent to the form that announces the current state:

```tsx
<p className="sr-only" aria-live="polite" aria-atomic="true">
  {isSubmitting ? 'Submitting…' : ''}
</p>
```

Add `.sr-only` to `features.css`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Keep the button text change ("Recruiting…") as a sighted visual indicator. The `aria-live` region serves the screen reader audience independently.
