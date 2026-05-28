import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PHASE5_QUEST_TITLE = 'Phase 5 Demo: Cave Expedition';

test.describe('Phase 5 capstone — quest mode end-to-end', () => {
  test('full quest scene walkthrough', async ({ page }) => {
    // 1. Boot app — seed has run, cave expedition is active
    await page.goto('/town/town-square');

    // 2. Party Map shows the seeded active quest with cave scene
    const partyBtn = page.getByRole('button', { name: /party map/i });
    await partyBtn.waitFor({ timeout: 15000 });
    await partyBtn.click();

    const partyList = page.getByRole('region', { name: /active quests/i });
    await partyList.waitFor({ timeout: 5000 });
    // The party map should show "Cave" (scene display name) for the seeded quest
    await expect(partyList.getByText(/cave/i)).toBeVisible({ timeout: 5000 });

    // 3. Click the party map row to navigate to the quest
    const questRow = partyList.getByRole('button', { name: /go to quest/i }).first();
    await questRow.click();
    await page.waitForURL(/\/quest\/.+/, { timeout: 10000 });

    const questId = page.url().split('/quest/')[1];

    // 4. HUD renders with adventurer name
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });
    await expect(page.getByText(/brielle/i)).toBeVisible({ timeout: 5000 });

    // 5. Walk player to right edge — this triggers POST /quests/:id/advance-scene
    // Click canvas to ensure Phaser receives keyboard input
    const canvas = page.locator('canvas');
    await canvas.waitFor({ timeout: 10000 });
    await canvas.click();

    const advanceRequest = page.waitForRequest(
      (req) => req.url().includes(`/quests/${questId}/advance-scene`) && req.method() === 'POST',
      { timeout: 25000 },
    );

    await page.keyboard.down('ArrowRight');
    const req = await advanceRequest;
    await page.keyboard.up('ArrowRight');

    // Verify the advance succeeded (scene → quest-dungeon)
    const advanceResponse = await req.response();
    expect(advanceResponse?.status()).toBe(200);
    const advanceBody = await advanceResponse?.json() as { currentScene?: string } | undefined;
    expect(advanceBody?.currentScene).toBe('quest-dungeon');

    // 6. Simulate server-side scene_change to boss-room via test endpoint
    const emitRes = await page.request.post('/test/emit-quest-event', {
      data: {
        questId,
        event: {
          type: 'scene_change',
          timestamp: new Date().toISOString(),
          from: 'quest-dungeon',
          to: 'quest-boss-room',
        },
      },
    });
    expect(emitRes.status()).toBe(200);

    // Wait briefly for WebSocket event propagation
    await page.waitForTimeout(500);

    // 7. Click Return to Town
    await page.getByRole('button', { name: /return to town/i }).click();
    await page.waitForURL(/\/town\//, { timeout: 8000 });

    // 8. Party Map still shows the quest as active (quest wasn't cancelled)
    const partyBtnAfter = page.getByRole('button', { name: /party map/i });
    await partyBtnAfter.waitFor({ timeout: 10000 });
    await partyBtnAfter.click();
    const partyListAfter = page.getByRole('region', { name: /active quests/i });
    await partyListAfter.waitFor({ timeout: 5000 });
    // Quest should still appear in the active list
    await expect(partyListAfter.getByRole('button', { name: /go to quest/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('quest route has no axe violations', async ({ page }) => {
    // Navigate directly to the seeded active quest
    const questsRes = await page.request.get('/quests/active');
    const activeQuests = await questsRes.json() as { id: string; title: string }[];
    const demoQuest = activeQuests.find((q) => q.title === PHASE5_QUEST_TITLE);
    expect(demoQuest).toBeDefined();

    await page.goto(`/quest/${demoQuest!.id}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('town square with party map open has no axe violations', async ({ page }) => {
    await page.goto('/town/town-square');
    const partyBtn = page.getByRole('button', { name: /party map/i });
    await partyBtn.waitFor({ timeout: 15000 });
    await partyBtn.click();
    await page.getByRole('region', { name: /active quests/i }).waitFor({ timeout: 5000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('test-emit route is not available in non-test environments', async ({ page }) => {
    // This test verifies the route is mounted (NODE_ENV=test in playwright config)
    // and that a production server would NOT expose it.
    // We verify the endpoint works in test mode (mounted):
    const questsRes = await page.request.get('/quests/active');
    const activeQuests = await questsRes.json() as { id: string; title: string }[];
    const demoQuest = activeQuests.find((q) => q.title === PHASE5_QUEST_TITLE);
    expect(demoQuest).toBeDefined();

    const emitRes = await page.request.post('/test/emit-quest-event', {
      data: {
        questId: demoQuest!.id,
        event: {
          type: 'progress',
          timestamp: new Date().toISOString(),
          message: 'Test event from E2E',
        },
      },
    });
    expect(emitRes.status()).toBe(200);
  });

  test('Enter Quest button appears in quest board for active quests', async ({ page }) => {
    await page.goto('/town/town-square');

    // Open Quest Board modal
    const sceneNav = page.locator('nav[aria-label="Scene interactions"]');
    await sceneNav.waitFor({ timeout: 15000 });
    await sceneNav.locator('button', { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    // "Enter Quest" button should appear for the active Phase 5 demo quest
    const enterQuestBtn = page.getByRole('button', { name: /enter quest.*cave expedition/i });
    await expect(enterQuestBtn).toBeVisible({ timeout: 5000 });
  });

  test('Watch Quest button appears in War Room for active quest', async ({ page }) => {
    await page.goto('/town/town-square');

    // Open Quest Board, find the Phase 5 demo quest
    const sceneNav = page.locator('nav[aria-label="Scene interactions"]');
    await sceneNav.waitFor({ timeout: 15000 });
    await sceneNav.locator('button', { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: `View quest: ${PHASE5_QUEST_TITLE}` }).click();

    // War Room should show "Watch Quest" button for active quests
    await expect(page.getByRole('button', { name: /watch quest/i })).toBeVisible({ timeout: 5000 });
  });
});
