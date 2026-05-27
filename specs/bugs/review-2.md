# BUG: Conditional assertion in Town Square empty-state e2e test

**Severity:** HIGH
**File(s):** `packages/client/tests/e2e/town-square.spec.ts`

## Problem

The test `Town Square empty state shows helpful message` at `town-square.spec.ts:75-87` wraps its assertion in a `.catch(() => {})`:

```ts
test('Town Square empty state shows helpful message', async ({ page }) => {
  await page.goto('/town');

  await page.getByRole('button', { name: /Town Square/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Quest board empty state
  await expect(
    page.getByText(/No quests yet/i).or(page.getByText(/no adventurers yet/i)),
  ).toBeVisible({ timeout: 3000 }).catch(() => {
    // Either or both empty states might appear depending on server state
  });
});
```

The `.catch(() => {})` swallows the assertion failure. The test will PASS even if neither empty-state message ever appears. This is a conditional/skipped assertion — the test validates nothing.

The task spec lists the empty states as acceptance criteria:
> Empty states preserved: "No quests yet — visit the War Room" / "No adventurers yet — click the recruit banner"

So this is exactly the behavior that needs to be verified — but the test as written cannot fail.

This pattern violates `.claude/rules/testing.md` ("Conditional Assertions (Banned)") and the common-finding "Conditional test assertions" in `.claude/rules/common-findings.md`.

## Expected

Assertions must be unconditional. The test must fail if the expected empty-state message is not present.

If the data depends on server state, the test must either:
1. Seed/reset the database before the test so the empty state is deterministic, OR
2. Inspect the actual API response and assert the matching UI (empty state vs populated list), unconditionally on either branch.

## Fix

Make the assertion deterministic. For example, intercept the `/quests` and `/adventurers` API responses with empty arrays via a route handler so the empty state is guaranteed:

```ts
test('Town Square empty state shows helpful message', async ({ page }) => {
  await page.route('**/quests', (route) => route.fulfill({ json: [] }));
  await page.route('**/adventurers', (route) => route.fulfill({ json: [] }));

  await page.goto('/town');
  await page.getByRole('button', { name: /Town Square/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await expect(page.getByText(/No quests yet/i)).toBeVisible();
  await expect(page.getByText(/No adventurers yet/i)).toBeVisible();
});
```

Remove the `.catch(() => {})` entirely. The test must fail loudly when the empty state is missing.
