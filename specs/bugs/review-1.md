# BUG: Missing axe-core E2E coverage for populated Hall of Returns view and detail modal

**Severity:** HIGH
**File(s):** `packages/client/tests/e2e/all-buildings.spec.ts`, `packages/client/src/__tests__/hall-of-returns.test.tsx`

## Problem

The task acceptance criteria explicitly requires: "Axe-core: zero violations on the Hall of Returns view and the detail modal."

The only existing axe-core coverage for Hall of Returns is the generic "all placeholder building dialogs" test in `all-buildings.spec.ts`, which:

1. Still classifies `hall-of-returns` as a `PLACEHOLDER_BUILDINGS` entry (line 13) even though this PR replaces the placeholder with a real feature.
2. Only exercises the empty / error state (no quest fixtures loaded) — it never renders the populated two-column view, the quest cards, or the detail modal that this task introduces.
3. Has no test that clicks a card and runs axe-core against the returned-quest detail modal.

Because the new card markup (`<button>` containing `<div>`, `<p>`, `<ul>`, badges with `aria-hidden`) and the detail modal (`role="alert"` on a static block, mixed heading hierarchy) only render with data, those code paths are completely unchecked by axe-core. The acceptance criteria is not met.

## Expected

Per `metrics/task-galle-context.md`:
- Acceptance criteria #5: "Axe-core: zero violations on the Hall of Returns view and the detail modal."

Per `.claude/rules/accessibility.md` rule 11: "Run accessibility checks (axe-core or equivalent) in E2E tests — zero violations policy."

Both the populated Hall of Returns view (with cards) and the detail modal must be exercised by an axe-core test with non-empty fixtures.

## Fix

1. Move `hall-of-returns` out of `PLACEHOLDER_BUILDINGS` in `packages/client/tests/e2e/all-buildings.spec.ts` (it is no longer a placeholder).
2. Add a dedicated Playwright spec that seeds the server (or stubs `/quests/returned`) with at least one complete and one failed quest, navigates to `/town/hall-of-returns`, and:
   - Runs axe-core against the populated two-column list view.
   - Clicks a card to open the detail modal, then runs axe-core against the detail view.
3. Both axe-core runs must assert `expect(results.violations).toEqual([])`.
