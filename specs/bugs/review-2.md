# BUG: 404 empty-state never displayed — fetchJson throws plain Error, not ApiError

**Severity:** CRITICAL
**File(s):** packages/client/src/lib/api.ts, packages/client/src/routes/quest.tsx

## Problem

`QuestRoute` decides whether to show the "Quest not found — return to town" copy by checking:

```ts
// packages/client/src/routes/quest.tsx:72
const is404 = error instanceof ApiError && error.status === 404;
```

But `api.quests.get` resolves through `fetchJson` (`packages/client/src/lib/api.ts:104-109`):

```ts
async function fetchJson<S extends z.ZodTypeAny>(schema: S, path: string): Promise<z.output<S>> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  ...
}
```

That branch throws a plain `Error`, not an `ApiError`. (`postJson` and `patchJson` in the same file DO throw `ApiError` — `fetchJson` is the inconsistent one.) So in production, a real 404 from `GET /quests/:id` produces a plain `Error("API error: 404 Not Found")`. `is404` evaluates to `false`, and the user always sees the fallback:

> "Could not load quest. Make sure the server is running."

The dedicated 404 copy required by the spec ("Quest not found — return to town") is unreachable from a real network response. The test passes only because it manually rejects with `new ApiError(...)`, which is not what the real API client produces.

## Expected

Per the task spec (`metrics/task-cestus-context.md`):
> "Show empty state if quest doesn't exist: 'Quest not found — return to town' with a button."

A real `GET /quests/:id` returning 404 must trigger the "Quest not found" empty state. The test for the 404 path must exercise the real `fetchJson` error shape, not a manually-constructed `ApiError`.

## Fix

1. Make `fetchJson` throw `ApiError` with `status` (matching `postJson`/`patchJson`):
   ```ts
   async function fetchJson<S extends z.ZodTypeAny>(schema: S, path: string): Promise<z.output<S>> {
     const res = await fetch(`${BASE_URL}${path}`);
     if (!res.ok) {
       const raw: unknown = await res.json().catch(() => ({ error: `${res.statusText}` }));
       const parsed = ApiErrorBodySchema.safeParse(raw);
       const msg = parsed.success ? parsed.data.error : `${res.status} ${res.statusText}`;
       const field = parsed.success ? parsed.data.field : undefined;
       throw new ApiError(msg, { field, status: res.status, data: raw });
     }
     const data: unknown = await res.json();
     return schema.parse(data) as z.output<S>;
   }
   ```
2. Update the 404 test in `quest-route.test.tsx` to mock `fetch` (or the underlying transport) returning a 404 response — not to manually reject with `ApiError` — so the regression is caught next time someone touches `fetchJson`.
3. Verify other call sites that may have caught plain Errors from `fetchJson` (e.g. `api.quests.list`, `api.adventurers.list`) still behave correctly with `ApiError` — search for `instanceof Error` checks that may need updating.
