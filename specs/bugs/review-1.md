# BUG: E2E test contains banned conditional assertions that silently skip validation

**Severity:** HIGH
**File(s):** `packages/client/tests/e2e/phase-9-capstone.spec.ts`

## Problem

The Phase 9 capstone Playwright spec wraps several core-flow assertions in conditional gates that the testing rules explicitly ban. When the condition is false the assertion never runs, the test passes vacuously, and a regression in the wrapped behaviour escapes review:

- Line 300 — `Split dialog requires at least 2 child stubs before enabling submit`:
  ```ts
  await expect(submitBtn).toBeDisabled({ timeout: 3000 }).catch(() => {
    // Some implementations start with 2 pre-filled stubs; verify at least the form is present
  });
  ```
  Catching the assertion failure turns a "must be disabled" check into a no-op for any other state.

- Line 341 — `Guild Hall with scars has no accessibility violations`:
  ```ts
  if (await scarBadge.isVisible()) {
    await scarBadge.click();
  }
  ```

- Lines 369-373 — `Re-post flow: dialog submits and shows toast with new quest` (the headline re-post test):
  ```ts
  if (await submitBtn.isEnabled()) {
    await submitBtn.click();
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
  }
  ```
  If the submit button never becomes enabled (the real failure mode), the whole assertion block is skipped and the test reports green.

- Lines 391-394 — `Retire flow: confirm retire and see success toast`:
  ```ts
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click();
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
  }
  ```
  Same pattern — the failure mode (confirm button missing) is the path that silently passes.

## Expected

Per `.claude/rules/testing.md` ("Conditional Assertions (Banned)") and `.claude/rules/common-findings.md` #9: assertions must be unconditional. The test must assert the element IS visible / enabled, click it, and assert the resulting state. Conditional gates and `.catch(() => {})` swallows around assertions are forbidden — the repo even enforces this via `checks/conditional-assertions.sh`.

## Fix

Rewrite each test to make the assertion unconditional:

- Split dialog: drop the `.catch()` and assert the actual starting state of the dialog (e.g. assert the dialog is open and the submit button is disabled, OR assert it is enabled with the pre-filled stubs — pick one based on the implementation and assert it deterministically).
- Guild Hall axe scan: assert `scarBadge` is visible, then click it. Do not gate the click on `isVisible()`.
- Re-post flow: assert `submitBtn` is enabled (mock the pre-fill state so it is), click it, then assert the toast appears.
- Retire flow: assert `confirmBtn` is visible, click it, then assert the toast appears.

If a step legitimately depends on a precondition the mocks don't guarantee, fix the mocks so the precondition holds — don't paper over with `if (...)`.
