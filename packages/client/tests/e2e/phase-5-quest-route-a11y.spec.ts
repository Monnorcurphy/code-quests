import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Phase 5 — quest route accessibility', () => {
  test('quest route with HUD has no axe violations', async ({ page }) => {
    // Create a quest so we have a valid questId to navigate to
    const createRes = await page.request.post('/quests', {
      data: {
        title: `A11y-Quest-${Date.now()}`,
        description: 'Quest for accessibility testing of the quest route.',
        acceptanceCriteria: ['Route renders without violations'],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = await createRes.json() as { id: string };

    await page.goto(`/quest/${quest.id}`);
    // Wait for HUD to be present (quest data loaded)
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('quest route 404 empty state has no axe violations', async ({ page }) => {
    await page.goto('/quest/nonexistent-quest-id-00000000');
    // Wait for the error/empty state
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForFunction(
      () => document.querySelector('main p') !== null,
      { timeout: 10000 },
    );

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
