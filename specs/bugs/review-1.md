# BUG: Missing test for `monster_appeared` query cache invalidation

**Severity:** HIGH
**File(s):** `packages/client/src/features/quest/__tests__/use-quest-stream.test.tsx`, `packages/client/src/features/quest/use-quest-stream.ts`

## Problem

The task spec explicitly requires that `monster_appeared` events invalidate the `['monsters']` TanStack Query cache so the Library bestiary stays in sync during a running quest. The production code at `use-quest-stream.ts:43-45` does this:

```ts
if (event.type === 'monster_appeared') {
  void queryClientRef.current.invalidateQueries({ queryKey: ['monsters'] });
}
```

But the test suite has NO assertion that `invalidateQueries` is called with `['monsters']` on `monster_appeared`. The only existing `monster_appeared` test (`use-quest-stream.test.tsx:267-286`) verifies the encounter store is notified but does not check `mockInvalidateQueries` (the mock fixture is already wired up at line 26 and is used in the `completed` and `failed` tests at lines 171 / 190).

This means a regression that removes the `invalidateQueries` call would not be caught — the Library would silently fail to refresh until the user reopens it.

## Expected

Per the task spec acceptance criteria and `rules/testing.md` ("Unit tests for every command handler, API endpoint, or public function" + "Every async function that calls an external service must have a test where the call rejects" pattern applied to integration boundaries), the cache-invalidation side effect of `monster_appeared` must be covered by a test.

## Fix

Add a test in `packages/client/src/features/quest/__tests__/use-quest-stream.test.tsx` that:

1. Renders `useQuestStream('q1')`.
2. Dispatches a `monster_appeared` event through `mockConnects[0].onEvent(...)`.
3. Asserts `expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['monsters'] })`.

Add it next to the existing `monster_appeared` test for discoverability.
