# BUG: War Room briefly shows "No adventurers in the guild" while adventurers list query is loading

**Severity:** LOW
**File(s):** packages/client/src/features/war-room.tsx, packages/client/src/features/quests/auto-match-preview.tsx

## Problem
`war-room.tsx` runs two independent React Query fetches in parallel for an `idle` quest:

1. `useQuery({ queryKey: ['adventurers'], queryFn: api.adventurers.list })` — fetches the guild list
2. Inside `AutoMatchPreview`, `useQuery({ queryKey: ['quest-auto-match', questId], queryFn: ... })` — fetches the auto-match suggestion

`war-room.tsx:186` collapses the loading state to an empty array:

```tsx
const adventurers: Adventurer[] = (rawAdventurers as Adventurer[] | undefined) ?? [];
```

If the auto-match query resolves *before* the adventurers query (or React Query renders an intermediate frame), `AutoMatchPreview` receives `adventurers=[]` while `!isLoading && !error && data` is true, and renders:

- A "Suggested: Brielle the Bold — Champion class + 8 wins, no relevant scars" line (from auto-match data), AND
- A "No adventurers in the guild — recruit one first." paragraph (because `adventurers.length === 0`).

These two messages directly contradict each other. The state is transient (the list query resolves shortly), but it is observable.

The same problem makes the empty-state assertion at line 73 of the new test (`auto-match-preview.test.tsx`) only valid because the test passes `adventurers: []` explicitly — it does not catch the race in war-room.

## Expected
Per `.claude/rules/state-management.md` ("Read State Before Using It") and the UX rule that loading states must not look like empty states, the component should distinguish "adventurers still loading" from "guild is empty."

## Fix
In `war-room.tsx`, expose the loading state and pass it through to `AutoMatchPreview`, OR delay rendering the override dropdown until both queries are settled.

Suggested minimal change in `war-room.tsx`:

```tsx
const { data: rawAdventurers, isLoading: adventurersLoading } = useQuery({
  queryKey: ['adventurers'],
  queryFn: api.adventurers.list,
});
const adventurers: Adventurer[] = (rawAdventurers as Adventurer[] | undefined) ?? [];
```

Add an `adventurersLoading` prop to `AutoMatchPreview` and in the override section, only show "No adventurers in the guild" when `!adventurersLoading && adventurers.length === 0`. While `adventurersLoading` is true, render a small loading hint or simply suppress the dropdown section.

Add a regression test in `auto-match-preview.test.tsx` that renders the component with `adventurers=[]` but the auto-match data resolved to a real adventurer — the test should assert the empty-state message is NOT shown (or that the loading hint is shown instead).
