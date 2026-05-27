import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// SceneKeyboardNav exposes in-scene interactives to keyboard/screen-reader users.
// All building interactions in Phaser mode go through this hidden nav.
const SCENE_NAV = 'nav[aria-label="Scene interactions"]';

const PLACEHOLDER_BUILDINGS = [
  { name: 'Oracle', scene: 'oracle', phase: '3' },
  { name: 'Library', scene: 'library', phase: '10' },
  { name: 'Tavern', scene: 'tavern', phase: '3' },
  { name: 'Armory', scene: 'armory', phase: '3' },
];

test.describe('All buildings — Phaser town', () => {
  test('Town Square scene nav exposes all 7 building doors', async ({ page }) => {
    await page.goto('/town/town-square');
    await page.waitForSelector(`${SCENE_NAV} button`, { timeout: 15000 });

    const buildings = [
      'War Room',
      'Oracle',
      'Library',
      'Tavern',
      'Armory',
      'Guild Hall',
      'Hall of Returns',
    ];
    for (const name of buildings) {
      await expect(
        page.locator(`${SCENE_NAV} button`, { hasText: name }),
      ).toBeAttached();
    }
  });

  test('War Room scene opens the draft form via Planning Table', async ({ page }) => {
    await page.goto('/town/war-room');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Planning Table")`, {
      timeout: 15000,
    });

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' }).click({
      force: true,
    });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'War Room' })).toBeVisible();
    await expect(page.getByLabel('Title')).toBeVisible();
  });

  test('War Room dialog closes on Escape', async ({ page }) => {
    await page.goto('/town/war-room');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Planning Table")`, {
      timeout: 15000,
    });

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('War Room has no accessibility violations', async ({ page }) => {
    await page.goto('/town/war-room');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Planning Table")`, {
      timeout: 15000,
    });

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Guild Hall scene opens the roster dialog via Guild Roster', async ({ page }) => {
    await page.goto('/town/guild-hall');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Guild Roster")`, {
      timeout: 15000,
    });

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Guild Roster' }).click({
      force: true,
    });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Guild Hall' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Recruit Adventurer/i })).toBeVisible();
  });

  test('Guild Hall dialog closes on Escape', async ({ page }) => {
    await page.goto('/town/guild-hall');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Guild Roster")`, {
      timeout: 15000,
    });

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Guild Roster' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Guild Hall has no accessibility violations', async ({ page }) => {
    await page.goto('/town/guild-hall');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Guild Roster")`, {
      timeout: 15000,
    });

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Guild Roster' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  for (const { name, scene } of PLACEHOLDER_BUILDINGS) {
    test(`${name} scene shows a coming-soon dialog`, async ({ page }) => {
      await page.goto(`/town/${scene}`);
      // Placeholder scenes auto-set the coming-soon modal in create()
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('heading', { name })).toBeVisible();
    });

    test(`${name} placeholder dialog closes on Return to Town Square button`, async ({
      page,
    }) => {
      await page.goto(`/town/${scene}`);
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

      await page.getByRole('button', { name: 'Return to Town Square' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test(`${name} placeholder dialog closes on Escape`, async ({ page }) => {
      await page.goto(`/town/${scene}`);
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  }

  test('all placeholder building dialogs have no accessibility violations', async ({ page }) => {
    for (const { scene } of PLACEHOLDER_BUILDINGS) {
      await page.goto(`/town/${scene}`);
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  });
});
