# BUG: Badge count underreports when more than 20 quests are returned

**Severity:** LOW
**File(s):** `packages/client/src/features/town-square.tsx`

## Problem

`ReturnedQuestsBadge` regressed from displaying the server-side `total` to displaying `items.length`, which is capped by the API `limit` parameter (20):

```ts
// town-square.tsx:42-45
const { data: returnedData } = useQuery({
  queryKey: ['hall-of-returns', 'badge'],
  queryFn: () => api.hallOfReturns.listQuests({ status: 'returned_to_town', limit: 20 }),
});
// ...
const count = returnedData?.items.length ?? 0;
```

The previous implementation used `data?.total ?? 0` against `/quests/returned`, whose response schema (`ReturnedQuestsPageSchema` in `api.ts:64`) includes a `total: z.number()` field that the server populates regardless of page size.

Consequences:

- 25 returned quests → badge shows "📜 20 quests returned" instead of "📜 25 quests returned".
- The badge always fetches the full first page (20 items) just to get a count — wasteful when only the cardinality matters.

Single-user dev usage won't see >20 returned quests often, hence LOW; but it's a latent regression that will eventually mislead.

## Expected

The badge should display the true total count of quests in `returned_to_town` status, not the size of the first page.

## Fix

Either:

1. **Add `total` to `HallOfReturnsListSchema`** (and the server response) and surface it through `api.hallOfReturns.listQuests`. Then use `returnedData?.total ?? 0`.

2. **Add a count endpoint** (`GET /hall-of-returns/quests/count?status=returned_to_town`) and have the badge call that instead. Cheaper than fetching 20 items every render.

Either way, drop the `limit: 20` workaround in the badge query — the badge does not need page contents.
