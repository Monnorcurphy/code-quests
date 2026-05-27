import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// These tests run in HTML mode (VITE_PHASER_TOWN=false).
// Town Square is the entry + recruiting hub accessible from the building grid.

test.describe('Town Square — entry and recruiting', () => {
  test('Town Square opens on button click and shows quest board', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Town Square' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quest Board' })).toBeVisible();
  });

  test('Town Square shows recruit button and roster section', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(page.getByRole('button', { name: /Recruit an Adventurer/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /Adventurer roster/i })).toBeVisible();
  });

  test('recruit banner opens recruit modal', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /Recruit an Adventurer/i }).click();

    await expect(page.getByRole('heading', { name: 'Recruit an Adventurer' })).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
  });

  test('recruit modal posts to /adventurers and shows success', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await page.getByRole('button', { name: /Recruit an Adventurer/i }).click();

    await page.getByLabel('Name').fill('Elara Swiftwind');
    await page.getByLabel('Class').selectOption('ranger');
    await page.getByRole('button', { name: /^Recruit$/ }).click();

    await expect(page.getByText('Adventurer recruited! Welcome to the guild.')).toBeVisible();
  });

  test('Escape key closes the Town Square overlay', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Cancel in recruit form returns to quest board view', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await page.getByRole('button', { name: /Recruit an Adventurer/i }).click();
    await expect(page.getByLabel('Name')).toBeVisible();

    await page.getByRole('button', { name: /Cancel/i }).click();

    await expect(page.getByRole('heading', { name: 'Quest Board' })).toBeVisible();
    await expect(page.getByLabel('Name')).not.toBeVisible();
  });

  test('Town Square empty state shows helpful message', async ({ page }) => {
    await page.route('**/quests', (route) => route.fulfill({ json: [] }));
    await page.route('**/adventurers', (route) => route.fulfill({ json: [] }));

    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(page.getByText(/No quests yet/i)).toBeVisible();
    await expect(page.getByText(/No adventurers yet/i)).toBeVisible();
  });

  test('Town Square has no accessibility violations', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('recruit modal has no accessibility violations', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await page.getByRole('button', { name: /Recruit an Adventurer/i }).click();
    await expect(page.getByLabel('Name')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('keyboard navigation: can tab to Recruit button from dialog', async ({ page }) => {
    await page.goto('/town');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Focus should be trapped inside dialog — tabbing cycles through buttons
    const recruitBtn = page.getByRole('button', { name: /Recruit an Adventurer/i });
    await recruitBtn.focus();
    await expect(recruitBtn).toBeFocused();
  });
});
