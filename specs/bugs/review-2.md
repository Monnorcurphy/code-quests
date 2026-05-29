# BUG: Phase 10 capstone E2E test "Armory loadout shows new skill available chip" does not test the chip

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-10-capstone.spec.ts

## Problem

Lines 249–261 declare a test whose name promises to validate the new "🔓 New skill available" chip behavior — the headline Armory feature of Task indus:

```ts
test('Armory loadout shows new skill available chip when active skill not in equipment', async ({
  page,
}) => {
  await page.goto('/town/armory');
  await expect(page.getByRole('dialog', { name: /armory/i })).toBeVisible({ timeout: 15000 });

  // With no quest selected, there's a message about selecting a quest first
  // That's the current behavior — no quest selected state shows the message
  await expect(
    page.getByText(/no quest selected|select a quest/i),
  ).toBeVisible({ timeout: 5000 });
});
```

The body never:
- selects a quest (`selectedQuestId` stays `null`, so the loadout columns are not rendered at all)
- asserts the chip is visible
- clicks the chip
- verifies it scrolls to / highlights the first unequipped active skill

The test passes trivially as long as the "No quest selected" empty state appears, giving false-positive coverage on the headline feature. Per `rules/common-findings.md` §9 ("Conditional test assertions") and `rules/testing.md` ("Tests must be deterministic … assertions must validate something"), an assertion that does not exercise the named feature is a coverage gap.

This is the same class of failure the test for the Library news ribbon has (review-1) — claiming validation while testing something else.

## Expected

Capstone Acceptance Criterion 5 ("Playwright capstone test passes headlessly in CI") and Step 5 of the walkthrough require that the test:
1. Opens the Armory loadout with a real selected quest (use store injection or mock the quest selection).
2. Asserts the "🔓 New skill available" chip is visible (since an active skill in mock data is not in the equipment).
3. Clicks the chip and asserts the skills picker scrolls / the highlighted label is in view.
4. Toggles the new skill on, saves the loadout, verifies success.

## Fix

Set `selectedQuestId` on the town store before navigating (or after `goto`), e.g.:

```ts
await page.addInitScript((qid) => {
  // expose & set on window before app boot
  (window as unknown as { __initialQuestId?: string }).__initialQuestId = qid;
}, DEMO_QUEST_ID);
await page.goto('/town/armory');
await page.evaluate((qid) => {
  // @ts-expect-error — test-only hook
  window.__townStore?.setState?.({ selectedQuestId: qid, activeModal: 'armory-loadout' });
}, DEMO_QUEST_ID);

await expect(page.getByRole('button', { name: /new skill available/i })).toBeVisible();
await page.getByRole('button', { name: /new skill available/i }).click();
await expect(page.getByLabel(MOCK_SKILL_ACTIVE.name)).toBeVisible();
```

Then exercise the toggle + save flow (and add a follow-up assertion that the chip disappears once the skill is equipped, since `hasNewSkill` should flip to false).

If exposing the store on `window` is not yet wired up, add it in a test-only mount path or use a `setupMocks`-style helper that mocks `quests.patch` and reads the post-save equipment payload to confirm the new skill ID was included.
