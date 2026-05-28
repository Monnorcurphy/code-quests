# BUG: API failure silently shows "No quests" — error swallowed

**Severity:** LOW
**File(s):** packages/client/src/features/party-map/use-active-quests.ts, packages/client/src/features/party-map/party-map.tsx

## Problem

`useActiveQuests` destructures only `{ data, isLoading }` from `useQuery` and ignores `error`. When `GET /quests/active` fails (network down, 500, server crash), `data` is `undefined`, `quests` falls back to `[]`, and `isLoading` flips to `false`. The party-map then renders `⚔ No quests` — telling the user that they have no active quests when in fact we just couldn't talk to the server.

This is a silent error-swallowing pattern called out in `.claude/rules/common-findings.md` #8 ("Empty `catch {}` blocks — errors disappear, user sees nothing"). Using `useQuery` without surfacing `error` is the React-Query equivalent.

It also violates `.claude/rules/ux-design-principles.md` ("What just happened?" → Error: "Persist until user dismisses or retries successfully. `aria-live='assertive'`. Human-friendly copy, not error codes.").

## Expected

When the active-quests query errors, the user should see a visible error indication in the banner (e.g. `⚔ Offline` or a small error chip) rather than the falsy `⚔ No quests` state. The error should be distinguishable from the genuine empty state.

## Fix

1. Surface `error` from `useActiveQuests`:

```ts
export function useActiveQuests(): {
  entries: ActiveQuestEntry[];
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = useQuery({ ... });
  // ...
  return { entries, isLoading, error };
}
```

2. In `party-map.tsx`, branch the banner label on `error`:

```ts
const bannerLabel = error
  ? '⚔ Offline'
  : isLoading
    ? '⚔ …'
    : count === 0
      ? '⚔ No quests'
      : `⚔ ${count} active`;
```

3. Add a unit test that mocks the query to reject and asserts the banner shows the offline label, not "No quests".
