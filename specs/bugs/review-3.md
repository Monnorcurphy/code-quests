# BUG: test-emit production-gating test doesn't actually verify the negative case

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-5-capstone.spec.ts

## Problem

The task spec (`metrics/task-greatsword-context.md`, "Additional capstone-specific checks") requires:

> Test-only `POST /test/emit-quest-event` route is NOT mounted in `NODE_ENV=production` — verified by a test.

The test at `phase-5-capstone.spec.ts:111` has the name *"test-emit route is not available in non-test environments"* — but its body only confirms the route works in test mode:

```ts
test('test-emit route is not available in non-test environments', async ({ page }) => {
  // This test verifies the route is mounted (NODE_ENV=test in playwright config)
  // and that a production server would NOT expose it.
  // We verify the endpoint works in test mode (mounted):
  ...
  const emitRes = await page.request.post('/test/emit-quest-event', { ... });
  expect(emitRes.status()).toBe(200);
});
```

There is no assertion against a non-test environment. The test name lies about what it verifies, and the spec requirement is unmet.

## Expected

Per spec, a test must positively confirm the route is **not** mounted when `NODE_ENV !== 'test'`.

## Fix

Add a server-side unit test (e.g., `packages/server/src/index.test.ts` or a new `packages/server/src/routes/__tests__/test-emit.test.ts`) that:

1. Sets `process.env.NODE_ENV = 'production'`
2. Builds the express app via `createApp(db)`
3. Issues a request to `POST /test/emit-quest-event` and asserts a 404 response
4. Restores the prior `NODE_ENV`

And rename the existing E2E test so its name matches what it actually checks (e.g., "test-emit route is mounted when NODE_ENV=test").
