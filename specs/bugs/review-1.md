# BUG: Missing axe-core scan in party-map test (spec coverage gap)

**Severity:** HIGH
**File(s):** packages/client/src/features/party-map/__tests__/party-map.test.tsx (or a new packages/client/tests/e2e/party-map-a11y.spec.ts)

## Problem

The task spec for `glaive` lists the following coverage requirements for `party-map.test.tsx`:

> - Renders empty state when no active quests
> - Renders rows for each active quest
> - Clicking a row navigates
> - Collapsed/expanded toggles work via keyboard (Enter on the banner)
> - **axe-core scan: zero violations**

The first four are implemented, but no axe-core (or equivalent) accessibility scan was added. `grep -rn "axe" packages/client/src` returns no matches in `src/`. The project already uses `@axe-core/playwright` in other E2E specs (`tests/e2e/phase-1-capstone.spec.ts`, `tests/e2e/phase-5-quest-route-a11y.spec.ts`), so the pattern exists.

This is also called out in `.claude/rules/accessibility.md` rule 11 — "Zero violations: Run accessibility checks (axe-core or equivalent) in E2E tests — zero violations policy."

## Expected

Either:
- Add `jest-axe` (or equivalent) to the vitest test for `<PartyMap />` (expanded + collapsed states) and assert zero violations, OR
- Add a Playwright spec under `packages/client/tests/e2e/party-map-a11y.spec.ts` that loads `/town/town-square` and `/quest/:id`, ensures the party-map banner / expanded list are present, and runs `AxeBuilder({ page }).analyze()` — assert `results.violations` length is 0.

## Fix

Recommended: add a new E2E spec using the existing pattern.

```ts
// packages/client/tests/e2e/party-map-a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('party map banner — collapsed has no a11y violations', async ({ page }) => {
  await page.goto('/town/town-square');
  await page.getByRole('button', { name: /party map/i }).waitFor();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('party map banner — expanded has no a11y violations', async ({ page }) => {
  await page.goto('/town/town-square');
  await page.getByRole('button', { name: /party map/i }).click();
  await page.getByRole('region', { name: /active quests/i }).waitFor();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```
