# BUG: Repost/Split client schemas reject the actual server response (runtime ZodError)

**Severity:** CRITICAL
**File(s):** `packages/client/src/lib/api.ts`, `packages/client/src/features/hall-of-returns/actions/repost-dialog.tsx`, `packages/client/src/features/hall-of-returns/actions/split-dialog.tsx`

## Problem

`api.quests.repost` and `api.quests.split` parse the server response with Zod schemas that demand fields the server never sends:

```ts
const RepostResultSchema = z.object({
  newQuestId: z.string(),
  newTitle: z.string(),
}).passthrough();

const SplitResultSchema = z.object({
  questIds: z.array(z.string()),
  titles: z.array(z.string()),
}).passthrough();
```

But `packages/server/src/routes/quest-actions.ts` returns:

- `POST /quests/:id/actions/repost` → `rowToApi(newRow)` — a full quest object with `id`, `epicId`, `title`, `description`, `acceptanceCriteria`, …. **No `newQuestId` or `newTitle` fields exist.**
- `POST /quests/:id/actions/split` → `{ originalQuest, childQuests }`. **No `questIds` or `titles` fields exist.**

`.passthrough()` does NOT make required keys optional — it only stops Zod from stripping unknown keys. Verified directly with a zod 3.25.76 parse:

```
REPOST parse success: false  (missing newQuestId, newTitle)
SPLIT parse success: false   (missing questIds, titles)
```

The unit tests all pass because each dialog test calls `vi.mock('../../../../lib/api', ...)` and replaces `api.quests.repost`/`split` with a mock that returns the *expected client shape*. The schema parser is never exercised against the real server response — the canonical "mocked boundary hides the mismatch" scenario the review contract warns about.

**Runtime impact:** the first time a user clicks "Re-post Quest" or "Split into N Quests" in the post-mortem, the API call succeeds (server returns 201), then `postJson`'s `schema.parse(data)` throws. The dialog catches the error and shows "Could not re-post quest. Please try again." (or "Could not split quest…") — the action looks broken even though the server actually created the quests. The success toast and linkage in `action-bar.tsx` never render.

## Expected

Per `rules/cross-boundary.md` and `rules/review-contract.md` boundary-contract section: values flowing between systems must match on both sides. Either:
- the client schema mirrors the server response shape (full quest / `originalQuest+childQuests`), and the action-bar reads the appropriate fields out of it, OR
- the server endpoints are adjusted to return `{ newQuestId, newTitle }` / `{ questIds, titles }`.

The spec's natural reading is "client surfaces the new title and links to the new quest" — that data is already present in the server's response (`row.id`, `row.title`, `childQuests[i].id`, `childQuests[i].title`).

## Fix

Pick one of the two paths above; the lower-blast-radius option is to fix the client:

1. In `packages/client/src/lib/api.ts`:
   - Replace `RepostResultSchema` with a schema that matches `rowToApi`'s output (re-use `QuestSchema` or a relaxed `passthrough` shape with `id` and `title`).
   - Replace `SplitResultSchema` with `{ originalQuest: <quest>, childQuests: <quest>[] }`.
   - Export adapter helpers (or update the public types `RepostResult` / `SplitResult`) so the dialogs can keep returning the small `{ newQuestId, newTitle }` / `{ questIds, titles }` shape to `ActionBar`.

2. In `repost-dialog.tsx` and `split-dialog.tsx`, map the server's response into the existing `RepostResult` / `SplitResult` shape before calling `onSuccess`, so `ActionBar` doesn't need to change:

```ts
const quest = await api.quests.repost(questId, { ... });
onSuccess({ newQuestId: quest.id, newTitle: quest.title });
```

```ts
const { childQuests } = await api.quests.split(questId, payload);
onSuccess({
  questIds: childQuests.map(q => q.id),
  titles: childQuests.map(q => q.title),
});
```

3. Add an integration test (or extend an existing one) that hits the real server endpoint with the real Zod parser in the loop, so future schema drift fails verify rather than at user click time. The current dialog tests mock the boundary and therefore cannot catch this class of bug.
