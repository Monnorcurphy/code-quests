# BUG: Library news ribbon misuses role="alert" for persistent UI; interrupts screen readers on every mount

**Severity:** LOW
**File(s):** packages/client/src/features/town-square.tsx

## Problem

`LibraryNewsRibbon` (lines 12–49 of `town-square.tsx`) wraps the ribbon container in `role="alert"`:

```tsx
return (
  <div className="library-news-ribbon" role="alert" aria-label={label}>
    <span className="library-news-ribbon-text">{label}</span>
    <button … aria-label="Open Library Skills tab">Go to Library</button>
  </div>
);
```

`role="alert"` has implicit `aria-live="assertive"` and `aria-atomic="true"`. ARIA semantics reserve this for "important, and usually time-sensitive, information" that should *interrupt* the user's current screen-reader announcement (errors, urgent warnings).

The Library news ribbon is none of those:
- It is persistent UI — every time the user opens the Town Square (a common, frequent action) the ribbon mounts again and screen readers will interrupt with "Library has news…".
- Its content is informational/navigational, not urgent.
- It contains an interactive button — `role="alert"` on a button container is also semantically odd.

Additionally, `aria-label={label}` on the wrapper duplicates the visible text inside the same wrapper; depending on AT, the user may hear the label and then the text again.

Per `rules/ux-feedback.md`: "All loading states must be announced to screen readers via `aria-live='polite'` regions" — polite is the right level for non-urgent updates. Per `rules/accessibility.md` rules 6, 8, 10: ARIA should match semantic intent and not interrupt unnecessarily.

## Expected

Use a polite live region (or no live region at all, since the ribbon is non-transient and can be discovered via normal page traversal). Remove the duplicate `aria-label` on the container.

## Fix

Change the wrapper to either:

```tsx
<aside className="library-news-ribbon" aria-live="polite" aria-label={label}>
  <span className="library-news-ribbon-text">{label}</span>
  <button … aria-label="Open Library Skills tab">Go to Library</button>
</aside>
```

…or drop the live region entirely and just use a semantic `<aside>` / `<section aria-label="Library news">`. The button inside already exposes its own affordance — the ribbon does not need to announce itself assertively.

If you keep `aria-label` on the wrapper, drop the duplicated visible-text reading by making the inner `<span>` `aria-hidden="true"` (or vice versa — drop `aria-label` and let the visible text be read). One source of truth, not both.
