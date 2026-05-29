# BUG: Phase 10 capstone E2E uses banned conditional assertions and silent error swallowing

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-10-capstone.spec.ts

## Problem

`packages/client/tests/e2e/phase-10-capstone.spec.ts` contains multiple patterns explicitly banned by `.claude/rules/testing.md` and `.claude/rules/common-findings.md` §9:

1. **Click-then-swallow (line 193):**
   ```ts
   await page.getByRole('button', { name: /open town square/i }).click().catch(() => {});
   ```
   No "intentionally swallowed: <reason>" comment and the swallowed failure hides the real issue (the button does not exist).

2. **Conditional click with `isVisible().catch`** (lines 200–203, 289–296):
   ```ts
   const openBtn = page.getByRole('button', { name: /town square/i }).first();
   if (await openBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
     await openBtn.click();
   }
   ```
   ```ts
   if (await monsterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
     await monsterBtn.click();
     ...
   } else {
     await expect(page.getByText(/no monsters|empty/i).or(...)).toBeVisible({ timeout: 5000 });
   }
   ```
   These patterns silently skip when the element is not present, so the test "passes" while validating nothing of substance. From `rules/testing.md`: "Never wrap assertions in `if (await element.isEnabled())` — These silently skip when the condition is false — the test passes but validates nothing."

3. **`isVisible({...}).catch(() => false)`** doubles down by hiding any error from `isVisible` itself (not just the visibility result).

## Expected

Per `rules/testing.md` and `rules/common-findings.md` §9:
- Assertions must be unconditional. Assert that the element IS visible, not "if it is, do X."
- Every `catch` must surface the error or include a comment justifying the swallow.
- E2E tests must deterministically reproduce the spec's interaction path; if state setup is required (e.g. opening a modal), do it explicitly via store injection or a known UI step rather than conditional click attempts.
- `checks/conditional-assertions.sh` exists as a hard gate — these patterns would be caught by it.

## Fix

For each affected test:

- Remove the conditional `if (await el.isVisible())` wrappers. Replace with explicit setup that guarantees the element is present (e.g. inject `activeModal` into the Zustand store before asserting), then assert visibility unconditionally.
- Remove every `.catch(() => {})` and `.catch(() => false)`. Either let the failure surface (preferred) or add an inline comment explaining why the failure is acceptable.
- For the monster-detail test (line 283–297), the mock data is fully controlled by the test (`MOCK_MONSTERS` always contains Grimtooth) — the monster button must be visible, so the conditional branch is dead. Drop the conditional, assert the button is visible, click it, and assert the Forge Skill button appears. The fallback branch hides the real problem if the bestiary fails to render the list.

After fixing, re-run `pnpm test:e2e --grep "Phase 10"` and `checks/conditional-assertions.sh` (if present) to confirm the patterns are gone.
