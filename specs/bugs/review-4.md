# BUG: `role="alert"` misused on static failure summary in detail view

**Severity:** LOW
**File(s):** `packages/client/src/features/quests/returned-quest-detail.tsx`

## Problem

The failure block in `ReturnedQuestDetail` uses `role="alert"`:

```tsx
{quest.status === 'failed' && quest.failureSummary && (
  <div className="return-detail-failure" role="alert">
    <p>…Why it failed:… {quest.failureSummary.reason}</p>
    <p>…Recommendation:… …</p>
  </div>
)}
```

Per WAI-ARIA, `role="alert"` is for "an important and usually time-sensitive message" with `aria-live="assertive"` semantics — it interrupts the screen reader to announce dynamic content. The failure summary here is historical information about an already-failed quest, not a real-time event.

Side effects:
- The block is re-announced every time the detail view mounts (e.g., on every card click), which is noisy and confusing.
- It steals priority from any actual live region elsewhere on the page.

## Expected

Per `.claude/rules/ux-feedback.md`: "Error messages persist until dismissed by user action … never auto-dismiss errors" and live regions are reserved for async, non-foreground state changes. Static historical content is not an alert.

## Fix

Remove `role="alert"`. The failure block is already labeled by its `<strong>Why it failed:</strong>` and `<strong>Recommendation:</strong>` text. Optionally use a semantic element such as `<aside aria-labelledby="...">` if you want to group it as a complementary region, but no live-region role is appropriate.
