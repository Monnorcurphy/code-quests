# BUG: Phase 10 capstone E2E test for the Library news ribbon never opens the Town Square modal — assertion will time out

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-10-capstone.spec.ts

## Problem

The first capstone test (`Town Square shows Library has news ribbon when candidates exist`) at lines 191–206 of `phase-10-capstone.spec.ts` is structurally broken and does not exercise the feature it claims to validate.

```ts
test('Town Square shows Library has news ribbon when candidates exist', async ({ page }) => {
    await page.goto('/town/town-square');
    await page.getByRole('button', { name: /open town square/i }).click().catch(() => {});

    await page.goto('/town/town-square');

    const openBtn = page.getByRole('button', { name: /town square/i }).first();
    if (await openBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await openBtn.click();
    }

    await expect(page.getByText(/library has news/i)).toBeVisible({ timeout: 10000 });
});
```

The `LibraryNewsRibbon` (defined in `packages/client/src/features/town-square.tsx`) is rendered only inside `QuestBoardPanel`, which is shown only when `activeModal === 'quest-board'`. The `town-square` Phaser scene does NOT auto-open the quest-board modal on `create()` (compare `town-square-scene.ts` to `library-scene.ts:47` which DOES auto-open its modal). The Quest Board can only be reached by interacting with the Phaser canvas, which Playwright's DOM-based `getByRole('button', ...)` cannot click.

Result: there is no "open town square" button in the DOM, the conditional `if (await openBtn.isVisible…)` falls through silently, and the final assertion will time out after 10s and fail. Capstone Acceptance Criterion 5 ("Playwright capstone test passes headlessly in CI") is not met.

## Expected

Per the spec (Task indus, Step 2): "Open `http://localhost:5173` → Town Square renders, 'Library has news' ribbon visible." The test must actually render the Town Square panel that hosts the ribbon, then assert it is visible.

## Fix

Drive the modal open from test code rather than relying on Phaser interaction. Inject `activeModal: 'quest-board'` into the Zustand `townStore` after navigation, e.g.:

```ts
await page.goto('/town/town-square');
await page.waitForLoadState('domcontentloaded');
await page.evaluate(() => {
  // @ts-expect-error — test-only access to global store
  window.__townStore?.setState?.({ activeModal: 'quest-board' });
});
await expect(page.getByRole('dialog', { name: /town square/i })).toBeVisible({ timeout: 5000 });
await expect(page.getByText(/library has news/i)).toBeVisible({ timeout: 5000 });
```

This requires exposing the town store on `window` in dev/test builds (mirror what other test specs do — search the repo for `__townStore` or similar test hooks). Alternatively, dispatch the keyboard event the Phaser interactive listens for, or restructure `LibraryNewsRibbon` to also render in the Town scene chrome so the ribbon is observable on `/town/town-square` directly.

Remove the unreachable click attempts and `.catch(() => {})` swallowers — they hide the actual failure mode.
