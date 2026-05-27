# BUG: town-square.spec.ts E2E suite still targets the removed HTML town and will fail end-to-end

**Severity:** CRITICAL
**File(s):** packages/client/tests/e2e/town-square.spec.ts

## Problem

The task removed the HTML town (deleted `VITE_PHASER_TOWN` flag, removed `HtmlTown`, made Phaser the only town). `phase-1-capstone.spec.ts` and `all-buildings.spec.ts` were correctly migrated to use the new Phaser-mode selectors (`nav[aria-label="Scene interactions"]` buttons, direct `/town/<scene-key>` URLs, etc.).

`packages/client/tests/e2e/town-square.spec.ts` was NOT migrated. Every test in the file:

1. Header comment still claims `These tests run in HTML mode (VITE_PHASER_TOWN=false).` — the flag no longer exists in `playwright.config.ts`.
2. All ten tests issue `await page.goto('/town')` and then `await page.getByRole('button', { name: /Town Square/i }).click()` (or `/War Room/i`, `/Recruit an Adventurer/i`, etc.). In the new Phaser-only town there is no `Town Square` HTML button — the only role=button elements with that name live in the visually-hidden `nav[aria-label="Scene interactions"]`, and they trigger `Quest Board` / `Recruit Banner` actions, not a full Town Square dialog open.
3. The visible Town Square overlay used to be opened by clicking a building button; in the new model it is opened by the Phaser scene firing into the store. The spec never sets `activeModal`, so `page.getByRole('dialog')` will never appear.

Running `pnpm test:e2e` (a command the new README explicitly documents) will execute this file alongside the capstone specs and every test in it will fail. The phase-capstone requirement "every Phase 1 feature is reachable inside the new Phaser town" and the task's own promise that "Phase 1 capstone E2E test passes" hold only because the capstone file was migrated — the suite as a whole is red.

## Expected

Per the task spec:
- "the `VITE_PHASER_TOWN` flag is removed; Phaser town is now the only town"
- "`packages/client/tests/e2e/phase-1-capstone.spec.ts` — update selectors so the Phase 1 walkthrough still passes against the Phaser-rendered town (it MUST still pass)"
- The README now documents `pnpm test:e2e` as the way to run E2E tests, implying the whole suite is green.

`town-square.spec.ts` either needs to be migrated to the Phaser-mode selectors (the same pattern used in `phase-1-capstone.spec.ts` — `/town/town-square`, `${SCENE_NAV} button { hasText: 'Quest Board' }`, etc.) or deleted because `phase-1-capstone.spec.ts` already covers the same scenarios.

## Fix

Option A (recommended — its coverage is already duplicated in `phase-1-capstone.spec.ts`): delete `packages/client/tests/e2e/town-square.spec.ts`.

Option B: rewrite every test to follow the Phaser-mode pattern used in `phase-1-capstone.spec.ts`:
- Replace `await page.goto('/town')` with `await page.goto('/town/town-square')` + `await waitForSceneNav(page)`.
- Replace `getByRole('button', { name: /Town Square/i }).click()` with `page.locator('nav[aria-label="Scene interactions"] button', { hasText: 'Quest Board' }).click({ force: true })`.
- Remove the stale comment "These tests run in HTML mode (VITE_PHASER_TOWN=false)."
- Adjust the `Cancel in recruit form returns to quest board view` test for the new flow (recruit panel now `setActiveModal('quest-board')` on cancel, which re-renders TownSquare quest-board mode).

After the fix run `pnpm test:e2e` and confirm every spec is green.
