import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SCENE_NAV = 'nav[aria-label="Scene interactions"]';

async function waitForScene(page: Parameters<typeof test.fn>[0]['page'], buttonLabel: string) {
  await page.waitForSelector(`${SCENE_NAV} button:has-text("${buttonLabel}")`, {
    timeout: 15000,
  });
}

async function createActiveQuest(page: Parameters<typeof test.fn>[0]['page'], title: string) {
  const createRes = await page.request.post('/quests', {
    data: {
      title,
      description: 'A quest created by the cancel test to verify cancellation flow.',
      acceptanceCriteria: ['Quest can be cancelled by the user', 'Cancel sets status to failed'],
    },
  });
  expect(createRes.status()).toBe(201);
  const created = await createRes.json() as { id: string };

  // PATCH to active to avoid offline adapter timing race
  const patchRes = await page.request.patch(`/quests/${created.id}`, {
    data: { status: 'active' },
  });
  expect(patchRes.status()).toBe(200);

  return created.id;
}

test.describe('Phase 4 cancel — quest cancellation flow', () => {
  test('cancel button flow: confirm → quest transitions to failed with retire recommendation', async ({
    page,
  }) => {
    const suffix = Date.now();
    const questTitle = `P4-Cancel-${suffix}`;
    const questId = await createActiveQuest(page, questTitle);

    // Navigate to Town Square → Quest Board → select the quest
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: `View quest: ${questTitle}` }).click();

    // Active Quest Panel and Cancel button should be visible
    await expect(
      page.getByRole('region', { name: /active quest progress/i }),
    ).toBeVisible({ timeout: 5000 });

    const cancelBtn = page.getByRole('button', { name: /cancel quest/i });
    await expect(cancelBtn).toBeVisible({ timeout: 5000 });
    await cancelBtn.click();

    // Confirm dialog appears
    await expect(page.getByText(/abandon this quest/i)).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /keep going/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /abandon quest/i })).toBeVisible();

    // Confirm cancel
    await page.getByRole('button', { name: /abandon quest/i }).click();

    // "Quest cancelled." success message appears
    await expect(page.getByText(/quest cancelled/i)).toBeVisible({ timeout: 5000 });

    // Quest transitions to 'failed' — terminal view shows "Quest failed."
    await expect(page.getByText(/quest failed/i)).toBeVisible({ timeout: 5000 });

    // Verify the recommendation is 'retire' via API
    const questRes = await page.request.get(`/quests/${questId}`);
    expect(questRes.status()).toBe(200);
    const quest = await questRes.json() as {
      status: string;
      failureSummary: { reason: string; recommendation: string } | null;
    };
    expect(quest.status).toBe('failed');
    expect(quest.failureSummary).not.toBeNull();
    expect(quest.failureSummary?.recommendation).toBe('retire');
    expect(quest.failureSummary?.reason).toBe('User cancelled');
  });

  test('cancel confirm dialog: "Keep going" aborts the cancellation', async ({ page }) => {
    const suffix = Date.now();
    const questTitle = `P4-KeepGoing-${suffix}`;
    await createActiveQuest(page, questTitle);

    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: `View quest: ${questTitle}` }).click();
    await expect(
      page.getByRole('region', { name: /active quest progress/i }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /cancel quest/i }).click();
    await expect(page.getByText(/abandon this quest/i)).toBeVisible({ timeout: 3000 });

    // Click "Keep going" — dialog dismisses, quest is still active
    await page.getByRole('button', { name: /keep going/i }).click();
    await expect(page.getByText(/abandon this quest/i)).not.toBeVisible();

    // Active Quest Panel is still visible — quest was NOT cancelled
    await expect(
      page.getByRole('region', { name: /active quest progress/i }),
    ).toBeVisible({ timeout: 3000 });
  });

  test('cancelled quest appears in Hall of Returns with retire recommendation', async ({ page }) => {
    const suffix = Date.now();
    const questTitle = `P4-CancelHoR-${suffix}`;
    const questId = await createActiveQuest(page, questTitle);

    // Cancel via API for reliability
    const cancelRes = await page.request.post(`/quests/${questId}/cancel`);
    expect(cancelRes.status()).toBe(200);

    await page.goto('/town/hall-of-returns');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(questTitle)).toBeVisible({ timeout: 5000 });

    // Should show in "Returned in Defeat" column
    await expect(page.getByText('Defeat').first()).toBeVisible();

    // Open detail modal
    const cardBtn = page.getByRole('button', {
      name: new RegExp(`view details for ${questTitle}`, 'i'),
    });
    await expect(cardBtn).toBeVisible();
    await cardBtn.click();

    // Verify 'retire' recommendation is shown
    await expect(
      page.getByText(/retire.*this quest should not be attempted again/i),
    ).toBeVisible({ timeout: 5000 });

    await expect(page.getByText(/user cancelled/i)).toBeVisible({ timeout: 5000 });

    // Axe check on failed-quest detail modal
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('cancel button has all three UX states (loading → success)', async ({ page }) => {
    const suffix = Date.now();
    const questTitle = `P4-CancelUX-${suffix}`;
    await createActiveQuest(page, questTitle);

    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: `View quest: ${questTitle}` }).click();
    await expect(
      page.getByRole('region', { name: /active quest progress/i }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /cancel quest/i }).click();
    await expect(page.getByText(/abandon this quest/i)).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: /abandon quest/i }).click();

    // Loading state: disabled "Cancelling…" button
    await expect(page.getByRole('button', { name: /cancelling/i })).toBeVisible({ timeout: 3000 });

    // Success state
    await expect(page.getByText(/quest cancelled/i)).toBeVisible({ timeout: 5000 });
  });
});
