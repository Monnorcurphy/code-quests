# BUG: phase-4-cancel.spec.ts will hit Playwright strict-mode violation on "View quest" lookup for active quests

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-4-cancel.spec.ts, packages/client/src/features/town-square.tsx, packages/client/src/features/quests/quest-board.tsx

## Problem

When a quest's status is `active`, two buttons in the open Quest Board panel share the exact same accessible name:

1. `ActiveQuestPeekItem` (town-square.tsx:71-78) renders `<button aria-label={`View quest: ${quest.title}`}>View</button>` inside the "Currently Questing" peek.
2. `QuestBoard` row (quest-board.tsx:86-90) renders `<button aria-label={`View quest: ${quest.title}`}>` for every quest regardless of status.

The new cancel spec PATCHes a freshly-created quest to `status: 'active'` and then clicks:

```ts
await page.getByRole('button', { name: `View quest: ${questTitle}` }).click();
```

`getByRole` is strict by default — it throws `strict mode violation: locator resolved to 2 elements` when more than one element matches. Every active-quest test path (`cancel button flow`, `Keep going aborts`, `cancel button has all three UX states`) hits this, plus the equivalent path in phase-4-capstone.spec.ts (`active-quest panel has no accessibility violations` line 178, and `Town Square peek shows active quests` line 211 still triggers the duplicate even though only the `Currently Questing` text is asserted on, because the React tree still contains both buttons).

A secondary a11y issue: two interactive buttons with identical accessible names is itself a screen-reader violation — the user cannot tell which "View quest: X" they're on.

## Expected

- The Playwright spec must uniquely identify the button it wants to click (use `.first()`, scope to the peek or board container, or use a unique accessible name per location).
- Or the components must distinguish the two buttons by accessible name (e.g., `aria-label="View quest (Currently Questing): X"` vs `"View quest (Board): X"`).

Per `rules/spec/never-skip-review.md` and `rules/accessibility.md`, the test suite must actually run; tests that throw strict-mode violations don't validate anything.

## Fix

Pick the simplest option:

1. In `phase-4-cancel.spec.ts` (4 occurrences) and `phase-4-capstone.spec.ts` (line 178 and 211), scope the click to the peek list so the duplicate in the QuestBoard doesn't match:

```ts
await page
  .locator('.active-quest-peek-list')
  .getByRole('button', { name: `View quest: ${questTitle}` })
  .click();
```

2. OR make the two aria-labels unique. Update town-square.tsx:75 to `aria-label={`View active quest: ${quest.title}`}` and tighten the test selectors accordingly.

Then re-run `pnpm test:e2e -- packages/client/tests/e2e/phase-4-cancel.spec.ts` to confirm the strict-mode violation no longer occurs.
