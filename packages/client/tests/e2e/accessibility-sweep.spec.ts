import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SCENE_NAV = 'nav[aria-label="Scene interactions"]';

// Helper: navigate to a town scene and wait for it to load
async function goToScene(
  page: Parameters<typeof test.fn>[0]['page'],
  scene: string,
) {
  await page.goto(`/town/${scene}`);
  await page.waitForSelector(SCENE_NAV, { timeout: 15000 });
}

// Helper: open a building dialog via the scene nav
async function openBuilding(
  page: Parameters<typeof test.fn>[0]['page'],
  scene: string,
  buttonText: string,
) {
  await goToScene(page, scene);
  await page.locator(`${SCENE_NAV} button`, { hasText: buttonText }).click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });
}

test.describe('Accessibility sweep — all key surfaces', () => {
  test('Town Square has no accessibility violations', async ({ page }) => {
    await goToScene(page, 'town-square');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Town Square' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('War Room has no accessibility violations', async ({ page }) => {
    await openBuilding(page, 'war-room', 'Planning Table');

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Guild Hall has no accessibility violations', async ({ page }) => {
    await openBuilding(page, 'guild-hall', 'Guild Roster');

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Oracle placeholder has no accessibility violations', async ({ page }) => {
    await page.goto('/town/oracle');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Library has no accessibility violations', async ({ page }) => {
    await page.goto('/town/library');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Armory placeholder has no accessibility violations', async ({ page }) => {
    await page.goto('/town/armory');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Tavern placeholder has no accessibility violations', async ({ page }) => {
    await page.goto('/town/tavern');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Hall of Returns has no accessibility violations', async ({ page }) => {
    await page.goto('/town/hall-of-returns');
    await page.waitForSelector(SCENE_NAV, { timeout: 15000 });
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Hall of Returns' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Quest scene (active quest) has no accessibility violations', async ({ page }) => {
    // Create a quest and dispatch it to get an active quest scene to test
    const createRes = await page.request.post('/quests', {
      data: {
        title: `A11y-Sweep-Quest-${Date.now()}`,
        description: 'Accessibility sweep test quest.',
        acceptanceCriteria: ['Tests pass'],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = await createRes.json() as { id: string };

    const dispatchRes = await page.request.post(`/quests/${quest.id}/dispatch?bypass=true`);
    expect(dispatchRes.status()).toBe(200);

    await page.goto(`/quest/${quest.id}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('PAUSED_INPUT modal has no accessibility violations', async ({ page }) => {
    // Create + dispatch a quest (offline adapter will pause it quickly)
    const createRes = await page.request.post('/quests', {
      data: {
        title: `A11y-Sweep-Paused-${Date.now()}`,
        description: 'Accessibility sweep paused modal test.',
        acceptanceCriteria: ['Modal is accessible'],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = await createRes.json() as { id: string };

    await page.request.post(`/quests/${quest.id}/dispatch?bypass=true`);

    // Wait for paused_input status
    await expect(async () => {
      const res = await page.request.get(`/quests/${quest.id}`);
      const body = await res.json() as { status: string };
      expect(body.status).toBe('paused_input');
    }).toPass({ timeout: 8000 });

    await page.goto(`/quest/${quest.id}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    const modal = page.getByRole('dialog', { name: /the path forks/i });
    await expect(modal).toBeVisible({ timeout: 5000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('prefers-reduced-motion: bell-flash visible for reduced-motion users', async ({ page }) => {
    // Emulate reduced-motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const createRes = await page.request.post('/quests', {
      data: {
        title: `A11y-Reduced-Motion-${Date.now()}`,
        description: 'Reduced motion test quest.',
        acceptanceCriteria: ['Bell flash shows'],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = await createRes.json() as { id: string };

    await page.request.post(`/quests/${quest.id}/dispatch?bypass=true`);

    await expect(async () => {
      const res = await page.request.get(`/quests/${quest.id}`);
      const body = await res.json() as { status: string };
      expect(body.status).toBe('paused_input');
    }).toPass({ timeout: 8000 });

    await page.goto(`/quest/${quest.id}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    // Bell cue should be visible
    await expect(page.getByTestId('bell-cue')).toBeVisible({ timeout: 5000 });

    // Bell flash should appear (reduced-motion static version)
    await expect(page.getByTestId('bell-flash')).toBeVisible({ timeout: 3000 });

    // Flash removes itself after ~800ms — assert the bell icon remains visible
    await expect(page.getByTestId('bell-cue')).toBeVisible();

    // Run accessibility check while in reduced-motion mode
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('prefers-reduced-motion: animations paused on quest page', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const createRes = await page.request.post('/quests', {
      data: {
        title: `A11y-Anim-Paused-${Date.now()}`,
        description: 'Animation paused check.',
        acceptanceCriteria: ['Animations respect reduced-motion'],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = await createRes.json() as { id: string };

    await page.request.post(`/quests/${quest.id}/dispatch?bypass=true`);

    await expect(async () => {
      const res = await page.request.get(`/quests/${quest.id}`);
      const body = await res.json() as { status: string };
      expect(body.status).toBe('paused_input');
    }).toPass({ timeout: 8000 });

    await page.goto(`/quest/${quest.id}`);
    await expect(page.getByRole('dialog', { name: /the path forks/i })).toBeVisible({ timeout: 5000 });

    // Verify body has data-quest-paused attribute when modal is visible
    await expect(page.locator('body')).toHaveAttribute('data-quest-paused', 'true');

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
