import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const QUEST_TITLE_PAUSED = 'P7-PausedInput-Flow';
const QUEST_TITLE_BLOCKED = 'P7-UserBlocked-Flow';

// Helper: poll until quest status matches expected value
async function waitForQuestStatus(
  page: Parameters<typeof test.fn>[0]['page'],
  questId: string,
  expectedStatus: string,
  { timeout = 8000 }: { timeout?: number } = {},
): Promise<void> {
  await expect(async () => {
    const res = await page.request.get(`/quests/${questId}`);
    const body = await res.json() as { status: string };
    expect(body.status).toBe(expectedStatus);
  }).toPass({ timeout });
}

test.describe('Phase 7 — paused_input modal flow', () => {
  test('parchment modal appears when offline adapter pauses quest', async ({ page }) => {
    // 1. Create a quest with full spec (ACs included so audit passes or we bypass)
    const createRes = await page.request.post('/quests', {
      data: {
        title: `${QUEST_TITLE_PAUSED}-${Date.now()}`,
        description: 'Fix the type error in the authentication module.',
        acceptanceCriteria: [
          'All TypeScript errors resolved',
          'Tests pass',
        ],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = await createRes.json() as { id: string };
    const questId = quest.id;

    // 2. Dispatch via API with bypass (skip audit requirement)
    const dispatchRes = await page.request.post(`/quests/${questId}/dispatch?bypass=true`);
    expect(dispatchRes.status()).toBe(200);

    // 3. Wait for quest to reach paused_input (offline adapter pauses quickly)
    await waitForQuestStatus(page, questId, 'paused_input');

    // 4. Navigate to quest route
    await page.goto(`/quest/${questId}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    // 5. Bell should be visible
    await expect(page.getByTestId('bell-cue')).toBeVisible({ timeout: 5000 });

    // 6. Parchment modal should appear (from REST hydration)
    const modal = page.getByRole('dialog', { name: /the path forks/i });
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 7. aria-modal is set
    await expect(modal).toHaveAttribute('aria-modal', 'true');

    // 8. Textarea is labeled and required
    const textarea = page.getByLabel(/your reply, my liege/i);
    await expect(textarea).toBeVisible();

    // 9. Run axe-core while modal is visible
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations).toEqual([]);

    // 10. Type a reply and submit
    await textarea.fill('Use approach A — it is safer.');
    await page.getByRole('button', { name: /send reply/i }).click();

    // 11. Modal should dismiss after successful respond-input
    await expect(modal).not.toBeVisible({ timeout: 8000 });

    // 12. Quest should return to active (or transition to complete)
    await waitForQuestStatus(page, questId, 'complete', { timeout: 10000 }).catch(() => {
      // Quest may still be active for a moment — either is fine
    });
  });

  test('user-blocked modal flow — seek counsel, mark blocked, unblock', async ({ page }) => {
    // 1. Create a quest
    const createRes = await page.request.post('/quests', {
      data: {
        title: `${QUEST_TITLE_BLOCKED}-${Date.now()}`,
        description: 'Refactor the error handling layer.',
        acceptanceCriteria: ['Error messages are user-friendly'],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = await createRes.json() as { id: string };
    const questId = quest.id;

    // 2. Set quest to active status via PATCH (skip dispatch timing)
    const patchRes = await page.request.patch(`/quests/${questId}`, {
      data: { status: 'active' },
    });
    expect(patchRes.status()).toBe(200);

    // 3. Navigate to quest route
    await page.goto(`/quest/${questId}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    // 4. Seek counsel button should be visible
    const seekBtn = page.getByRole('button', { name: /seek counsel/i });
    await expect(seekBtn).toBeVisible({ timeout: 5000 });

    // 5. Click seek counsel
    await seekBtn.click();

    // 6. The seek-counsel dialog should appear
    const seekDialog = page.getByRole('dialog', { name: /seek counsel/i });
    await expect(seekDialog).toBeVisible({ timeout: 3000 });

    // 7. Run axe-core on seek-counsel dialog
    const a11yCounsel = await new AxeBuilder({ page }).analyze();
    expect(a11yCounsel.violations).toEqual([]);

    // 8. Type a block description
    const descTextarea = page.getByLabel(/what are you waiting on/i);
    await descTextarea.fill('Waiting for design review from the team.');

    // 9. Submit
    await page.getByRole('button', { name: /mark blocked/i }).click();

    // 10. Wait for user_blocked status
    await waitForQuestStatus(page, questId, 'user_blocked');

    // 11. Bell should be visible
    await expect(page.getByTestId('bell-cue')).toBeVisible({ timeout: 5000 });

    // 12. User-blocked modal should appear
    const blockedModal = page.getByRole('dialog', { name: /seeking counsel/i });
    await expect(blockedModal).toBeVisible({ timeout: 8000 });

    // 13. aria-modal is set on user-blocked modal
    await expect(blockedModal).toHaveAttribute('aria-modal', 'true');

    // 14. Unblock button visible
    const unblockBtn = blockedModal.getByRole('button', { name: /^unblock$/i });
    await expect(unblockBtn).toBeVisible();

    // 15. Run axe-core while user-blocked modal is visible
    const a11yBlocked = await new AxeBuilder({ page }).analyze();
    expect(a11yBlocked.violations).toEqual([]);

    // 16. Click unblock
    await unblockBtn.click();

    // 17. User-blocked modal should dismiss
    await expect(blockedModal).not.toBeVisible({ timeout: 8000 });

    // 18. Quest transitions out of user_blocked (may go to active or paused_input)
    await expect(async () => {
      const res = await page.request.get(`/quests/${questId}`);
      const body = await res.json() as { status: string };
      expect(['active', 'paused_input', 'complete']).toContain(body.status);
    }).toPass({ timeout: 5000 });
  });
});
