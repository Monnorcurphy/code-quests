# BUG: Phase 3 capstone E2E test "active quest badge" uses banned conditional assertion

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-3-capstone.spec.ts

## Problem

The test at lines 277-295 wraps its assertions in `if (hasBadge)`:

```ts
const activeBadge = page.getByText('Active Quest');
const hasBadge = await activeBadge.isVisible({ timeout: 3000 }).catch(() => false);

// This is a soft assertion — if previous tests dispatched a quest, badge is visible
if (hasBadge) {
  await expect(activeBadge).toBeVisible();
  await expect(page.getByRole('button', { name: /view in war room/i })).toBeVisible();
}
```

If `hasBadge` is false (no badge present, or page errored out, or selector mismatched), the test exits with **zero assertions executed** — it passes silently while validating nothing. The author's own comment "soft assertion" acknowledges this. This is the exact anti-pattern listed in `.claude/rules/testing.md` rule #9 and `.claude/rules/common-findings.md` #9:

> "Tests wrap assertions in `if (element.isVisible())` — silently skip when false. The test 'passes' but validates nothing — bugs escape to production."

## Expected

The test must assert that the active quest badge appears unconditionally. If the test depends on a previous test having dispatched a quest, fix the dependency: either dispatch a quest inside this test, or use `test.beforeEach`/a shared fixture so the precondition is guaranteed before assertions run.

## Fix

1. Make the test self-contained: dispatch a quest inside the test (similar pattern to the `dispatch flow` test at line 228), then return to Town Square and assert the badge is visible.
2. Remove the `if (hasBadge)` wrapper; replace with unconditional:
   ```ts
   await expect(page.getByText('Active Quest')).toBeVisible({ timeout: 5000 });
   await expect(page.getByRole('button', { name: /view in war room/i })).toBeVisible();
   ```
