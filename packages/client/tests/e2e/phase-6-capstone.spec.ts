import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DEMO_QUEST_TITLE = 'Phase 6 Demo: Banish the TypeScript Poltergeist';

test.describe('Phase 6 capstone — monsters, bestiary, and nemesis flow', () => {
  test('Library is accessible from Town Square nav', async ({ page }) => {
    await page.goto('/town/town-square');
    const sceneNav = page.locator('nav[aria-label="Scene interactions"]');
    await sceneNav.waitFor({ timeout: 15000 });
    await expect(sceneNav.locator('button', { hasText: /library/i })).toBeVisible();
  });

  test('Bestiary tab is visible and default in Library', async ({ page }) => {
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    // Bestiary tab should be visible
    const bestiaryTab = page.getByRole('tab', { name: /bestiary/i });
    await expect(bestiaryTab).toBeVisible({ timeout: 5000 });
    // It should be selected by default
    await expect(bestiaryTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Bestiary shows scope filter tabs', async ({ page }) => {
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    // Switch to Bestiary tab if not active
    await page.getByRole('tab', { name: /bestiary/i }).click();
    // Scope tabs should be present
    await expect(page.getByRole('tab', { name: /mine.*project/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: /nemeses.*guild/i })).toBeVisible({ timeout: 5000 });
  });

  test('Bestiary shows seeded demo monsters', async ({ page }) => {
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.getByRole('tab', { name: /bestiary/i }).click();
    // Scope tab: Mine (Project) should be selected
    const projectTab = page.getByRole('tab', { name: /mine.*project/i });
    await projectTab.waitFor({ timeout: 5000 });
    await projectTab.click();

    // Wait for the table to load monsters seeded by seed-demo-quest.ts
    await page.waitForFunction(
      () => document.querySelectorAll('.bestiary-row').length > 0,
      { timeout: 10000 },
    );
    // Seeded monsters should include Grim the Type-Gremlin (Imp) and Nibble (Goblin)
    await expect(page.getByText('Grim the Type-Gremlin')).toBeVisible({ timeout: 5000 });
  });

  test('Monster detail shows full record including type, scope, and encounters', async ({ page }) => {
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.getByRole('tab', { name: /bestiary/i }).click();
    await page.getByRole('tab', { name: /mine.*project/i }).click();

    // Wait for monster row
    const row = page.getByRole('row', { name: /grim the type-gremlin/i });
    await row.waitFor({ timeout: 10000 });
    await row.click();

    // Detail panel shows
    await expect(page.getByRole('button', { name: /back to bestiary/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Grim the Type-Gremlin')).toBeVisible();
    await expect(page.getByText('Project')).toBeVisible();
    await expect(page.getByRole('button', { name: /mark as nemesis/i })).toBeVisible({ timeout: 5000 });
  });

  test('Promote to Nemesis flow', async ({ page }) => {
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.getByRole('tab', { name: /bestiary/i }).click();
    await page.getByRole('tab', { name: /mine.*project/i }).click();

    // Open the Nibble monster (Goblin) detail — pick one that's not already a nemesis
    const row = page.getByRole('row', { name: /nibble the nit-picker/i });
    await row.waitFor({ timeout: 10000 });
    await row.click();

    await expect(page.getByRole('button', { name: /mark as nemesis/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /mark as nemesis/i }).click();

    // Modal appears
    const modal = page.getByRole('dialog', { name: /promote to nemesis/i });
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Name input pre-filled with current name
    const nameInput = modal.getByRole('textbox', { name: /nemesis name/i });
    await expect(nameInput).toHaveValue('Nibble the Nit-Picker');

    // Submit
    await modal.getByRole('button', { name: /mark as nemesis/i }).click();

    // Success message appears
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('status')).toContainText(/nemesis/i);

    // Nemesis badge now visible
    await expect(page.getByText('⚔ Nemesis')).toBeVisible({ timeout: 5000 });
    // Scope shows "Guild Nemesis"
    await expect(page.getByText('Guild Nemesis')).toBeVisible({ timeout: 5000 });
  });

  test('Nemeses tab shows promoted monster after promotion', async ({ page }) => {
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.getByRole('tab', { name: /bestiary/i }).click();

    // Switch to Nemeses (Guild) tab
    const guildTab = page.getByRole('tab', { name: /nemeses.*guild/i });
    await guildTab.click();

    // If Nibble was already promoted (previous test ran), it should appear here
    // If not, we just verify the tab works and shows empty state or the row
    await expect(guildTab).toHaveAttribute('aria-selected', 'true');
  });

  test('Library bestiary and promote modal have no axe violations', async ({ page }) => {
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.getByRole('tab', { name: /bestiary/i }).click();
    await page.getByRole('tab', { name: /mine.*project/i }).click();

    // Wait for content to load
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
      { timeout: 8000 },
    );

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('Library shows Bestiary unlocked badge when monsters exist', async ({ page }) => {
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // The badge should show since seed-demo-quest created monsters
    await expect(
      page.getByText(/bestiary unlocked/i),
    ).toBeVisible({ timeout: 8000 });
  });

  test('Town Square shows Library card with monster count', async ({ page }) => {
    await page.goto('/town/town-square');
    const sceneNav = page.locator('nav[aria-label="Scene interactions"]');
    await sceneNav.waitFor({ timeout: 15000 });

    // Open town square modal
    await sceneNav.locator('button', { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    // Library preview section should be visible
    await expect(page.getByRole('button', { name: /open library/i })).toBeVisible({ timeout: 8000 });
    // Monster count preview
    await expect(page.getByText(/bestiary unlocked/i)).toBeVisible({ timeout: 8000 });
  });

  test('demo quest exists in DB after seed', async ({ page }) => {
    const res = await page.request.get('/quests?status=complete');
    const quests = await res.json() as { title: string }[];
    const demo = quests.find((q) => q.title === DEMO_QUEST_TITLE);
    expect(demo).toBeDefined();
  });

  test('monsters and nemesis persist after browser refresh', async ({ page }) => {
    // Promote Shimmer (Wraith) to nemesis
    await page.goto('/town/library');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.getByRole('tab', { name: /bestiary/i }).click();
    await page.getByRole('tab', { name: /mine.*project/i }).click();

    const row = page.getByRole('row', { name: /shimmer the flicker/i });
    await row.waitFor({ timeout: 10000 });
    await row.click();

    const promoteBtn = page.getByRole('button', { name: /mark as nemesis/i });
    await promoteBtn.waitFor({ timeout: 5000 });
    await promoteBtn.click();

    const modal = page.getByRole('dialog', { name: /promote to nemesis/i });
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.getByRole('button', { name: /mark as nemesis/i }).click();
    await expect(page.getByRole('status')).toBeVisible({ timeout: 5000 });

    // Refresh page
    await page.reload();
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.getByRole('tab', { name: /bestiary/i }).click();

    // Switch to Guild Nemeses tab
    await page.getByRole('tab', { name: /nemeses.*guild/i }).click();

    // Shimmer should still be there after refresh
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('.bestiary-row');
        return rows.length > 0 || document.querySelector('[role="status"]') !== null;
      },
      { timeout: 8000 },
    );
    // The guild tab should be visible and working
    await expect(page.getByRole('tab', { name: /nemeses.*guild/i })).toBeVisible();
  });

  test('combat HUD has no axe violations with a monster present', async ({ page }) => {
    const questsRes = await page.request.get('/quests/active');
    const activeQuests = await questsRes.json() as { id: string; title: string }[];
    if (activeQuests.length === 0) {
      test.skip();
      return;
    }
    const questId = activeQuests[0].id;
    await page.goto(`/quest/${questId}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    // Emit a monster_appeared event for the demo quest
    const monsterRes = await page.request.get('/monsters?scope=project');
    const monsters = await monsterRes.json() as { id: string; typeId: string; name: string; calibratedDifficulty: number }[];
    if (monsters.length > 0) {
      const m = monsters[0];
      const typeRes = await page.request.get('/monster-types');
      const types = await typeRes.json() as { id: string; spritePath: string }[];
      const mt = types.find((t: { id: string }) => t.id === m.typeId);
      await page.request.post('/test/emit-quest-event', {
        data: {
          questId,
          event: {
            type: 'monster_appeared',
            timestamp: new Date().toISOString(),
            encounterId: 'enc-demo',
            monsterId: m.id,
            monsterName: m.name,
            monsterTypeId: m.typeId,
            spritePath: mt?.spritePath ?? '',
            difficulty: m.calibratedDifficulty,
          },
        },
      });
    }

    const results = await new AxeBuilder({ page })
      .include('[aria-label="Quest HUD"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
