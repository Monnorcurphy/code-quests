# BUG: Missing axe-core test for the new /quest/:questId route

**Severity:** HIGH
**File(s):** packages/client/src/__tests__/quest-route.test.tsx (or new e2e spec)

## Problem

The task spec explicitly lists this acceptance criterion:

> "axe-core scan on the quest route: zero violations."

The new test file `packages/client/src/__tests__/quest-route.test.tsx` covers render, navigation, and HUD content via React Testing Library, but contains no axe-core assertion. Searching the repo (`packages/client/tests/e2e`) shows axe-core is wired into the existing capstone specs for prior phases but no spec exercises the new `/quest/:questId` route.

Without this gate, the contrast and ARIA issues described in `review-3.md` will not be caught automatically.

## Expected

Per the task spec and `.claude/rules/accessibility.md` ("Zero violations: Run accessibility checks (axe-core or equivalent) in E2E tests — zero violations policy"), the new route must have an automated axe-core scan that asserts zero violations against:

- Loading state
- Rendered quest with HUD
- 404 empty state
- Active advance-scene feedback strip

## Fix

Either:

1. Add a Vitest test in `quest-route.test.tsx` that runs `axe(container)` from `vitest-axe` (or `jest-axe`) and expects `toHaveNoViolations()` against each state.

OR

2. Add a Playwright e2e spec (e.g. `packages/client/tests/e2e/phase-5-quest-route.spec.ts`) that navigates to `/quest/:questId` for a seeded quest and runs `injectAxe()` + `checkA11y()` (matching the pattern used in `phase-4-capstone.spec.ts`).

The Vitest-axe approach is faster and self-contained; the Playwright approach better simulates the real Phaser-mounted page but is heavier. Either satisfies the spec — pick whichever fits the existing test infrastructure.
