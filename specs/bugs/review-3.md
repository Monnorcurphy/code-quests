# BUG: Loading state and active-quest count changes not announced to screen readers

**Severity:** LOW
**File(s):** packages/client/src/features/party-map/party-map.tsx

## Problem

The party-map banner cycles through:
- `⚔ …` (loading — `isLoading === true`)
- `⚔ No quests` (loaded, empty)
- `⚔ 3 active` (loaded with quests, value changes as quests come/go on the 5s poll)

These changes happen on a non-live element (`<button>` with `aria-label`). Screen readers will only re-read the label when focus is on the button. A blind user not currently focused on the banner gets no notification when quests appear/disappear, and no loading announcement at all.

`.claude/rules/ux-feedback.md`: "All loading states must be announced to screen readers via `aria-live="polite"` regions."

`.claude/rules/ux-design-principles.md` ("What just happened?"): "Loading: Disable trigger button + spinner. `aria-busy="true"` on container."

Neither requirement is met:
- No `aria-live="polite"` region wrapping the count text.
- No `aria-busy` on the wrapper while `isLoading`.

## Expected

- The banner text (or a visually-hidden mirror of it) lives inside an `aria-live="polite"` region so screen readers announce count changes.
- The wrapper sets `aria-busy={isLoading}` while the initial fetch is pending.

## Fix

Add a visually-hidden live region inside the wrapper, or move the banner label into a polite live region. Minimal patch:

```tsx
<div
  data-testid="party-map"
  style={{ position: 'fixed', top: '8px', right: '8px', zIndex: 20, pointerEvents: 'none' }}
  aria-busy={isLoading || undefined}
  onKeyDown={handleKeyDown}
>
  <div style={{ pointerEvents: 'auto' }}>
    <button
      type="button"
      onClick={handleToggle}
      aria-expanded={expanded}
      aria-controls="party-map-list"
      style={BANNER_STYLE}
    >
      <span aria-live="polite" aria-atomic="true">{bannerLabel}</span>
    </button>
    {/* ...rest unchanged... */}
  </div>
</div>
```

Also drop the redundant `aria-label="Party Map"` on the outer wrapper (the button's accessible name already covers this) — or upgrade it to `role="complementary"` so the aria-label is meaningful.
