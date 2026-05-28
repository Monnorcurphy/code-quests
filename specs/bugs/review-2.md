# BUG: CombatLog uses array index as React key — unstable when 200-entry cap drops oldest

**Severity:** LOW
**File(s):** `packages/client/src/features/quest/combat-log.tsx`

## Problem

`combat-log.tsx` renders entries with `key={idx}`:

```tsx
logEntries.map((event, idx) => (
  <div key={idx} style={{ ... }}>
    ...
  </div>
))
```

The quest store caps entries at 200 by slicing the front of the array (`next.slice(-MAX_LOG_ENTRIES)`). Once the cap is hit, every subsequent append shifts every existing entry's index down by one. React reconciliation then re-binds DOM nodes onto different entries: the `<div>` previously rendering event at index 5 is now rendering the event that used to be at index 6. This can cause:

- Visual flicker / mismatched scroll position.
- Wrong animation start state if any motion is added later.
- Inaccurate `aria-live` announcement attribution (screen readers may re-read content for unchanged-looking nodes).

This is a well-known anti-pattern: using array index as `key` is only safe when items are append-only and never re-ordered or removed from the front.

## Expected

Per `.claude/rules/manifest.md`-linked state-management rules: stable keys for collections that can shrink or reorder. The combat log is exactly that — it drops from the front once full.

## Fix

Use a stable identifier on each entry. Options:

- Combine `timestamp + type + index-within-timestamp-bucket` (timestamps may collide for events emitted in the same millisecond).
- Add a client-side monotonically increasing `id` when the entry is appended (in `appendEvent` in `quest-store.ts`) and key on that.

Preferred: add an `id` field at append time so the combat log never has to guess.
