import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SCENE_NAV = 'nav[aria-label="Scene interactions"]';

async function waitForScene(page: Parameters<typeof test.fn>[0]['page'], buttonLabel: string) {
  await page.waitForSelector(`${SCENE_NAV} button:has-text("${buttonLabel}")`, {
    timeout: 15000,
  });
}

test.describe('Phase 4 capstone — end-to-end quest lifecycle', () => {
  test('dispatch a quest, it completes, then appears in Hall of Returns', async ({ page }) => {
    const suffix = Date.now();
    const questTitle = `P4-Capstone-${suffix}`;

    // Create a fully-specified quest via API
    const createRes = await page.request.post('/quests', {
      data: {
        title: questTitle,
        description:
          'Add a real-time notification system that alerts users when their quests complete or fail using the existing WebSocket infrastructure.',
        acceptanceCriteria: [
          'Notification appears within 2 seconds of quest status change',
          'Notifications are dismissible by the user',
        ],
      },
    });
    expect(createRes.status()).toBe(201);

    // Open Town Square → Quest Board → select the quest
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: `View quest: ${questTitle}` }).click();
    await expect(page.getByText(questTitle)).toBeVisible({ timeout: 5000 });

    // Run audit — quest has description + ACs so it passes
    await page.getByRole('button', { name: /run audit/i }).click();
    await expect(page.getByText(/all checks pass/i)).toBeVisible({ timeout: 10000 });

    // Dispatch — offline adapter runs and completes automatically
    const dispatchBtn = page.getByRole('button', { name: /^dispatch quest$/i });
    await expect(dispatchBtn).toBeVisible({ timeout: 5000 });
    await dispatchBtn.click();
    await expect(page.getByText(/quest dispatched/i)).toBeVisible({ timeout: 10000 });

    // Wait for quest to reach terminal state (offline adapter completes quickly)
    await expect(page.getByText(/quest complete!/i)).toBeVisible({ timeout: 10000 });

    // "Return to Hall of Returns" button should be present
    const hallBtn = page.getByRole('button', { name: /return to hall of returns/i });
    await expect(hallBtn).toBeVisible({ timeout: 5000 });
    await hallBtn.click();

    // Hall of Returns modal opens
    await expect(page.getByRole('dialog', { name: /hall of returns/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(questTitle)).toBeVisible({ timeout: 5000 });

    // Quest should appear under "Victorious"
    const questCard = page.getByRole('button', {
      name: new RegExp(`view details for ${questTitle}`, 'i'),
    });
    await expect(questCard).toBeVisible();

    // Open detail modal
    await questCard.click();
    await expect(page.getByRole('button', { name: /back to hall of returns/i })).toBeVisible();

    // Combat log should contain offline adapter events
    await expect(page.getByText(/setting out from town/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/skirmish with a goblin/i)).toBeVisible({ timeout: 5000 });

    // Adventurer name should be shown (auto-matched from guild)
    await expect(page.getByText(/brielle/i)).toBeVisible({ timeout: 5000 });

    // Close detail modal
    await page.getByRole('button', { name: /back to hall of returns/i }).click();
    await expect(page.getByText(questTitle)).toBeVisible({ timeout: 5000 });
  });

  test('completed quest persists after reload', async ({ page }) => {
    const suffix = Date.now();
    const questTitle = `P4-Persist-${suffix}`;

    // Create and dispatch quest via API for speed
    const createRes = await page.request.post('/quests', {
      data: {
        title: questTitle,
        description:
          'A persistence test quest that should appear in the Hall of Returns after reload.',
        acceptanceCriteria: [
          'Quest status persists across page reloads',
          'Combat log is retained after reload',
        ],
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json() as { id: string };

    // Dispatch with bypass to skip audit timing
    const dispatchRes = await page.request.post(`/quests/${created.id}/dispatch?bypass=true`);
    expect(dispatchRes.status()).toBe(200);

    // Wait for quest to complete (offline adapter auto-completes)
    await expect(async () => {
      const questRes = await page.request.get(`/quests/${created.id}`);
      const quest = await questRes.json() as { status: string };
      expect(quest.status).toBe('complete');
    }).toPass({ timeout: 5000 });

    // Navigate to Hall of Returns
    await page.goto('/town/hall-of-returns');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(questTitle)).toBeVisible({ timeout: 5000 });

    // Reload — quest persists
    await page.reload();
    await page.goto('/town/hall-of-returns');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(questTitle)).toBeVisible({ timeout: 5000 });
  });

  test('Hall of Returns view has no accessibility violations', async ({ page }) => {
    // Use the pre-seeded completed quest to ensure list is non-empty
    await page.goto('/town/hall-of-returns');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('returned-quest detail modal has no accessibility violations', async ({ page }) => {
    await page.goto('/town/hall-of-returns');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

    // Find any quest card (there should be at least the seeded Banish the Memory Leak one)
    const anyCard = page.getByRole('button', { name: /view details for/i }).first();
    await expect(anyCard).toBeVisible({ timeout: 5000 });
    await anyCard.click();

    await expect(page.getByRole('button', { name: /back to hall of returns/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('active-quest panel has no accessibility violations', async ({ page }) => {
    const suffix = Date.now();
    const questTitle = `P4-A11y-${suffix}`;

    // Create quest via API
    const createRes = await page.request.post('/quests', {
      data: {
        title: questTitle,
        description: 'An accessibility test quest for the active quest panel.',
        acceptanceCriteria: ['Panel is accessible', 'Screen readers announce events'],
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json() as { id: string };

    // PATCH to active so the panel renders without the offline adapter race
    await page.request.patch(`/quests/${created.id}`, {
      data: { status: 'active' },
    });

    // Open Town Square → Quest Board → select the quest
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: `View quest: ${questTitle}` }).click();
    await expect(
      page.getByRole('region', { name: /active quest progress/i }),
    ).toBeVisible({ timeout: 5000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Town Square peek shows active quests and has no accessibility violations', async ({ page }) => {
    const suffix = Date.now();
    const questTitle = `P4-Peek-${suffix}`;

    const createRes = await page.request.post('/quests', {
      data: {
        title: questTitle,
        description: 'A Town Square peek visibility test with active quest status.',
        acceptanceCriteria: ['Peek appears in Town Square', 'Click navigates to War Room'],
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json() as { id: string };

    await page.request.patch(`/quests/${created.id}`, {
      data: { status: 'active' },
    });

    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    // "Currently Questing" section should appear
    await expect(page.getByText('Currently Questing')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(questTitle)).toBeVisible({ timeout: 5000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('pre-seeded completed quest is visible in Hall of Returns', async ({ page }) => {
    await page.goto('/town/hall-of-returns');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Banish the Memory Leak')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Victory').first()).toBeVisible();
  });
});
