# BUG: Missing axe-core e2e coverage for `/hall-of-returns/:questId` post-mortem route
**Severity:** HIGH
**File(s):** `packages/client/tests/e2e/hall-of-returns.spec.ts`

## Problem

The TASK ebony spec lists "Axe-core scan: zero violations" as a hard acceptance criterion, and the project rule (`testing.md` → "E2E tests include accessibility checks (axe-core or equivalent) — zero violations policy") requires axe-core coverage at the E2E level.

The new `PostMortem` route at `/hall-of-returns/:questId` (wired in `packages/client/src/app.tsx:15`) is now the primary detail view for a returned quest, but there is no axe-core scan that visits this route:

- `packages/client/tests/e2e/hall-of-returns.spec.ts` covers the `/town/hall-of-returns` list dialog and an in-dialog detail view (legacy code from TASK cedar), not the new standalone post-mortem page.
- No new e2e spec file was added for TASK ebony.

Without axe-core coverage, the acceptance criterion ("zero violations") cannot be verified. Unit tests (`@testing-library/react`) do not execute axe; they only verify DOM structure.

## Expected

Per the spec acceptance criteria:

> Axe-core scan: zero violations

Per `.claude/rules/testing.md`:

> E2E tests include accessibility checks (axe-core or equivalent) — zero violations policy

A Playwright + `@axe-core/playwright` test must visit `/hall-of-returns/:questId` with mocked `GET /hall-of-returns/quests/:id/post-mortem` data, wait for the post-mortem main region to render, and assert `results.violations` is empty. The test should also exercise the expanded combat-log row (so the conditionally-rendered details list is in the DOM during the scan) and the error state.

## Fix

1. Extend `packages/client/tests/e2e/hall-of-returns.spec.ts` (or add `tests/e2e/post-mortem.spec.ts`) with at least two cases:
   - Loaded post-mortem with `failureSummary`, fatal monster, and at least one encounter → expand the row → run `new AxeBuilder({ page }).analyze()`; assert `results.violations.length === 0`.
   - Error state (500) → assert axe violations are zero on the error UI.
2. Route the mock with `await page.route('**/hall-of-returns/quests/*/post-mortem', ...)` mirroring the existing mocking pattern in `hall-of-returns.spec.ts`.
3. Navigate via `await page.goto('/hall-of-returns/q1')`; wait on `page.getByRole('heading', { name: /slay the dragon/i })` (or your fixture's title) before the axe scan.
4. Keep the scope tight (`new AxeBuilder({ page }).include('main')` is fine) so unrelated portions of the shell don't inflate the result.
