# BUG: Phase 1 capstone "persistence" test fails — Escape no longer fully closes Town Square modal

**Severity:** CRITICAL
**File(s):** `packages/client/src/features/town-square.tsx`, `packages/client/tests/e2e/phase-1-capstone.spec.ts`

## Problem

The refactor of `town-square.tsx` into two separate panels (`QuestBoardPanel` and `RecruitPanel`), each with its own `useFocusTrap`, changed the semantics of pressing Escape inside the recruit form:

- **Before:** A single `useFocusTrap(onClose)` wrapped both views — pressing Escape fully closed the whole Town Square overlay.
- **After:** `RecruitPanel` uses `useFocusTrap(onBack)` — pressing Escape navigates back to `QuestBoardPanel` (sets `activeModal='quest-board'`), it does NOT close the overlay.

The existing Phase 1 capstone test `persistence: adventurer and quest survive page reload` (`phase-1-capstone.spec.ts:98`) presses Escape ONCE after recruiting and then tries to click the War Room button:

```ts
await expect(page.getByText('Adventurer recruited! Welcome to the guild.')).toBeVisible();
await page.keyboard.press('Escape');

// Draft a unique quest
await page.getByRole('button', { name: /War Room/i }).click();
```

After the single Escape, the QuestBoardPanel (Town Square overlay) remains open. `.modal-backdrop` (`position: fixed; inset: 0; z-index: 100`) covers the building grid, so the War Room button is not actionable. The test times out:

```
locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /War Room/i })
```

Verified by running `npx playwright test phase-1-capstone` — 6 pass, 1 fail (persistence).

## Expected

The task spec acceptance criteria states: *"Phase 1 capstone E2E test passes against this new scene (updated selectors as needed)."*

The Phase 1 capstone suite must pass against the new Town Square implementation. The task spec explicitly allows updating selectors as needed, so the test may be updated to reflect the new two-step Escape semantics — but the suite must end green.

## Fix

Choose one of the following:

**Option A (preferred, matches new design):** Update `packages/client/tests/e2e/phase-1-capstone.spec.ts` to press Escape twice (or close via the explicit `Close` button) so the overlay fully dismisses:

```ts
await page.keyboard.press('Escape'); // recruit → quest-board
await page.keyboard.press('Escape'); // quest-board → closed
```

or equivalently:

```ts
await page.getByRole('button', { name: /^Close$/ }).click();
```

The same two-step closure may also be needed elsewhere in the test if it relies on the previous "Escape closes everything" behavior.

**Option B:** Change `RecruitPanel` so Escape fully closes the overlay (set `activeModal` to `null` rather than `'quest-board'`). This changes the new Town Square UX and breaks `town-square.spec.ts:62` ("Cancel in recruit form returns to quest board view"), so Option A is the cleaner fix.

After fixing, re-run `npx playwright test phase-1-capstone` and confirm all 7 tests pass.
