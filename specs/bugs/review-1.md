# BUG: Success banner is invisible in production — quest refetch hides it before user can see it

**Severity:** HIGH
**File(s):** packages/client/src/features/quests/dispatch-button.tsx

## Problem

`DispatchButton` returns `null` whenever `quest.status !== 'idle'`. After a successful dispatch:

1. `onSuccess` sets `success=true`, schedules the 3-second `setTimeout` for auto-dismiss, and calls `queryClient.invalidateQueries({ queryKey: ['quest', updated.id] })`.
2. `war-room.tsx` (line 28) has an active `useQuery({ queryKey: ['quest', questId] })`. Invalidation immediately triggers a refetch.
3. When the refetch resolves, the parent re-renders with the freshly-fetched quest whose `status === 'active'` and passes it back to `DispatchButton`.
4. `DispatchButton` evaluates `if (quest.status !== 'idle') return null;` (line 95) BEFORE reaching the success banner JSX, so the `<p className="dispatch-success">…Quest dispatched…</p>` element is removed from the DOM.

Result: in real usage the success banner flashes for at most the refetch round-trip (tens of milliseconds) and then vanishes. The `aria-live="polite"` region also empties before screen readers have time to announce it. The 3-second auto-dismiss requirement is silently violated.

The unit test `'shows success banner on 200 and auto-dismisses after 3 seconds'` passes only because the test re-renders with a static, hand-built quest — it never simulates the `useQuery` refetch path that happens in production.

## Expected

Per the task spec (TASK fluorite, file `metrics/task-fluorite-context.md`) and `rules/domain/frontend/ux-feedback.md`:

> 3-second auto-dismissing success banner; refetch quest; navigate to Town Square

The success banner must remain visible for ~3 seconds regardless of how the quest status changes during that window. The auto-dismiss timing also has to be testable against a parent that actually refetches.

## Fix

Render the success banner before the early-return so the visible-success state isn't coupled to the quest prop. For example:

```tsx
// Render the success banner first so a refetched 'active' quest doesn't hide it.
if (quest.status !== 'idle' && !success) return null;
```

…or hoist the success banner JSX above the `if (quest.status !== 'idle') return null;` guard and only short-circuit the rest of the controls.

Also add a regression test that simulates the parent refetch (e.g., wrap `DispatchButton` in a test harness that swaps the `quest` prop to `status: 'active'` immediately after `onSuccess`, then assert the banner is still in the DOM and only disappears once `vi.advanceTimersByTime(3000)` fires).
