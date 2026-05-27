import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// These tests run in HTML mode (VITE_PHASER_TOWN=false).
// They verify that every building can be opened from the town grid.

const PLACEHOLDER_BUILDINGS = [
  { name: 'Oracle', phase: '3' },
  { name: 'Library', phase: '10' },
  { name: 'Tavern', phase: '3' },
  { name: 'Armory', phase: '3' },
  { name: 'Hall of Returns', phase: '9' },
];

test.describe('All buildings — entry and return', () => {
  test('all 7 building buttons are visible on the town page', async ({ page }) => {
    await page.goto('/town');

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
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    }
  });

  test('War Room opens the draft form dialog', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /War Room/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'War Room' })).toBeVisible();
    await expect(page.getByLabel('Title')).toBeVisible();
  });

  test('War Room dialog closes on Escape', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /War Room/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('War Room has no accessibility violations', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /War Room/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Guild Hall opens the roster and recruit dialog', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Guild Hall/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Guild Hall' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Recruit Adventurer/i })).toBeVisible();
  });

  test('Guild Hall dialog closes on Escape', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Guild Hall/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Guild Hall has no accessibility violations', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Guild Hall/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  for (const { name } of PLACEHOLDER_BUILDINGS) {
    test(`${name} opens a placeholder dialog with building name`, async ({ page }) => {
      await page.goto('/town');

      await page.getByRole('button', { name: new RegExp(name) }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name })).toBeVisible();
    });

    test(`${name} placeholder dialog closes on Close button`, async ({ page }) => {
      await page.goto('/town');

      await page.getByRole('button', { name: new RegExp(name) }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test(`${name} placeholder dialog closes on Escape`, async ({ page }) => {
      await page.goto('/town');

      await page.getByRole('button', { name: new RegExp(name) }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  }

  test('all placeholder building dialogs have no accessibility violations', async ({ page }) => {
    await page.goto('/town');

    for (const { name } of PLACEHOLDER_BUILDINGS) {
      await page.getByRole('button', { name: new RegExp(name) }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  });

  test('focus returns to War Room button after dialog closes', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /War Room/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const warRoomBtn = page.getByRole('button', { name: /War Room/i });
    await expect(warRoomBtn).toBeFocused();
  });

  test('focus returns to Guild Hall button after dialog closes', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Guild Hall/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    const guildHallBtn = page.getByRole('button', { name: /Guild Hall/i });
    await expect(guildHallBtn).toBeFocused();
  });
});
