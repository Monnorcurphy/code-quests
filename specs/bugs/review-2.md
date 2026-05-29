# BUG: Bestiary typeId filter with zero matches renders an empty table with no "no matches" message

**Severity:** LOW
**File(s):** packages/client/src/features/library/bestiary.tsx

## Problem
When `initialTypeFilter` is set (via `/town/library?typeId=xxx`) but no monsters in the user's bestiary match that type, the user sees:

1. The "Filtered by type: <name>" banner (line 191-195)
2. The full sortable table header
3. An empty `<tbody>` — zero rows
4. No empty-state message

The cause is the empty-state check at line 246:

```typescript
{!isLoading && !isError && monsters?.length === 0 && (...empty state...)}
```

This branches on the **unfiltered** `monsters.length`, not on the filtered/sorted result. The render branch at line 259 (`monsters && monsters.length > 0`) wins, and the table renders headers with no rows. The user has no way to know whether the filter is broken, the monster type is unknown, or they simply haven't encountered it yet.

Concrete trigger from the cancer task: a user clicks "Browse Library" on a failed quest's `failure-summary-card` (line 64-70 in `failure-summary-card.tsx`) for a fatal monster of type `imp_typecheck`. If they've never recorded any `imp_typecheck` monster in their bestiary, the table is silently empty.

## Expected
Per `.claude/rules/ux-design.md` (rule "The user should never face a blank screen or dead end" and "Every list page has an empty state with a call to action") and `.claude/rules/common-findings.md` #5 (Missing empty states), an empty filtered list must show an empty-state message explaining what happened and offering a path forward (e.g., a "Clear filter" link, or copy like "No monsters of this type have been recorded yet").

## Fix
In `packages/client/src/features/library/bestiary.tsx`:

1. Compute `hasFilteredResults = sortedMonsters.length > 0` (or use `sortedMonsters.length`).
2. Add a new branch that triggers when `!isLoading && !isError && monsters && monsters.length > 0 && initialTypeFilter && sortedMonsters.length === 0`:
   - Render a `role="status"` block with copy like: "No monsters of type **<name>** have been recorded yet. They appear here once an adventurer encounters one."
   - Optionally include a "Clear filter" affordance that navigates to `/town/library` (without the typeId).
3. Tighten the table render branch to also require `sortedMonsters.length > 0` so the empty-tbody branch never fires when a filter is active.

Add a unit test in `bestiary.test.tsx` (create if missing) that mounts `<Bestiary initialTypeFilter="ghost_unknown" />` with mocked monsters that contain no `ghost_unknown`-typed monster, and asserts the empty-state message renders.
