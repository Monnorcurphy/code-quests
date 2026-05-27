# BUG: Dispatch E2E flow uses conditional assertions and waitForTimeout

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-3-capstone.spec.ts

## Problem

Two E2E tests (`dispatch flow: audit passes and quest becomes active` at line 228, and `state persists after reload` at line 307) use the banned `if (await element.isVisible())` pattern alongside `page.waitForTimeout()`:

```ts
const dispatchBtn = page.getByRole('button', { name: /^dispatch quest$/i });
if (await dispatchBtn.isVisible()) {        // banned: conditional control flow
  await dispatchBtn.click();
}

const dispatchAnyway = page.getByRole('button', { name: /dispatch anyway/i });
if (await dispatchAnyway.isVisible({ timeout: 3000 }).catch(() => false)) {  // banned
  await dispatchAnyway.click();
  await page.waitForTimeout(2500);          // flaky: hard sleep
  await page.getByRole('button', { name: /confirm dispatch$/i }).click();
}
```

Two problems:

1. **Conditional flow silently masks bugs.** If both `dispatchBtn` and `dispatchAnyway` are absent (e.g., a regression hid them), both branches are skipped and the test reaches `await expect(page.getByText(/quest dispatched/i)).toBeVisible({ timeout: 10000 })` having clicked nothing. The final expect will eventually fail, but the failure mode hides which path actually broke.
2. **`waitForTimeout` is non-deterministic.** `state persists` at line 333 sleeps 3000ms after `Run audit` clicked, hoping the audit result has rendered. On a slow CI, the audit may not be done yet; on a fast CI, the wait is wasted. This violates testing.md's "no flaky tests allowed" requirement.

## Expected

Per `.claude/rules/testing.md`:
- Rule 9 (Conditional Assertions Banned): "These silently skip when the condition is false — the test passes but validates nothing."
- Test isolation: "Tests must be deterministic — no flaky tests allowed."

## Fix

1. Determine which dispatch path each test exercises and assert it deterministically:
   - For the "fully-specified quest" test, the audit should pass cleanly; assert that `Dispatch quest` is visible, then click it. Drop the `dispatch anyway` branch entirely.
   - For tests that need `dispatch anyway`, set up that scenario explicitly (a quest with known gaps) and assert that `Dispatch anyway` is visible before clicking.
2. Replace `page.waitForTimeout(2500)` with explicit `await expect(page.getByRole('button', { name: /confirm dispatch$/i })).toBeEnabled()` — wait for the actual UI state, not wall-clock time.
3. Replace `page.waitForTimeout(3000)` (after Run audit) with `await expect(page.getByText(/all checks pass|gaps/i)).toBeVisible({ timeout: 10000 })`.
