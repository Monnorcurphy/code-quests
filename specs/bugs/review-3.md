# BUG: Returned-quests badge stays stale after retire / repost / split (no invalidation)

**Severity:** HIGH
**File(s):** `packages/client/src/features/town-square.tsx`, `packages/client/src/features/hall-of-returns/*` (action handlers)

## Problem

`ReturnedQuestsBadge` (town-square.tsx:39) keeps its own dedicated query key:

```ts
const { data: returnedData } = useQuery({
  queryKey: ['hall-of-returns', 'badge'],
  queryFn: () => api.hallOfReturns.listQuests({ status: 'returned_to_town', limit: 20 }),
});
```

Nothing else in the codebase invalidates this key. `grep -rn "invalidateQueries.*hall-of-returns" packages/client/src` shows only two writers, both for different keys:

- `use-returned-quests.ts:34` — invalidates `['hall-of-returns', 'quests']` (the list view)
- `use-post-mortem.ts:21` — invalidates `['hall-of-returns', 'post-mortem', ...]`
- `town-square.tsx:62` — invalidates `['hall-of-returns', 'badge']` only on `quest_returned` events from currently-`active` quests it has subscribed to

Action handlers (re-post, retire, split, feedback) do not invalidate the badge key. WebSocket events emitted on those actions (`quest_retired`, `quest_reposted`, `quest_split`) are not handled by the badge — its `subscribe()` calls only listen for `quest_returned`, and only on quests that were `active` at the time the effect ran.

Consequence — step 10 of the capstone acceptance criteria fails in the multi-tab case explicitly called out by the phase spec ("WebSocket invalidation works: completing the seeded failure flow in one tab updates the 'Returned Quests' badge in another tab"):

1. User retires the only returned quest.
2. Quest disappears from the Hall of Returns list view (because `RETURNED_QUESTS_KEY` is invalidated).
3. The Town Square badge still shows "📜 1 quest returned" until the badge component unmounts and remounts.

The same staleness applies to re-post (a successful re-post should leave the original in `returned_to_town`, so badge is fine there, but split moves the parent to a different status and the badge will still show it).

## Expected

Per phase-9 spec capstone check ("WebSocket invalidation works"): the badge must reflect Hall of Returns state in real time, including after retire/repost/split/feedback actions.

Per `.claude/rules/state-management.md` (Async Save Pattern): all user-modifiable entity actions must surface their state change to dependent views.

## Fix

Pick one of the two clean fixes:

**Option A — broaden invalidation in action handlers.** Each action handler that already invalidates `RETURNED_QUESTS_KEY` should also invalidate the badge key:

```ts
void queryClient.invalidateQueries({ queryKey: ['hall-of-returns'] }); // matches both 'quests' and 'badge'
```

`invalidateQueries` does a prefix match, so the single broader key invalidates the list, the badge, and the per-quest post-mortem entries in one call. Update every action handler in `packages/client/src/features/hall-of-returns/` that fires after a successful re-post / retire / split / feedback.

**Option B — broaden the badge's WebSocket subscription.** Subscribe the badge to all relevant quest_* events (`quest_returned`, `quest_retired`, `quest_reposted`, `quest_split`) AND subscribe to the IDs that are in `returned_to_town`, not just the active ones — otherwise retiring a quest that's already in the Hall doesn't fire on any handle the badge holds.

Option A is simpler and matches the convention used elsewhere in the codebase. Add a unit / integration test that retires a returned quest and asserts the badge count drops to 0 without a remount.
