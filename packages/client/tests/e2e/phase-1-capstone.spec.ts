import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BUILDINGS = [
  'Town Square',
  'War Room',
  'Oracle',
  'Library',
  'Tavern',
  'Armory',
  'Guild Hall',
  'Hall of Returns',
];

test.describe('Phase 1 capstone — end-to-end walkthrough', () => {
  test('8 buildings are visible on the Town page', async ({ page }) => {
    await page.goto('/');

    for (const name of BUILDINGS) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    }
  });

  test('Town page has no accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('recruit flow: adventurer appears in roster after recruiting', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /Recruit an Adventurer/i }).click();
    await expect(page.getByLabel('Name')).toBeVisible();

    await page.getByLabel('Name').fill('Brielle the Bold');
    await page.getByLabel('Class').selectOption('champion');
    await page.getByRole('button', { name: /^Recruit$/ }).click();

    await expect(page.getByText('Adventurer recruited! Welcome to the guild.')).toBeVisible();

    // After success, roster should show the adventurer (use first() in case of multiple runs)
    await expect(page.getByText('Brielle the Bold').first()).toBeVisible({ timeout: 5000 });
  });

  test('Town Square has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('quest draft flow: quest appears on Quest Board', async ({ page }) => {
    const questTitle = `Implement dark mode toggle`;

    await page.goto('/');

    await page.getByRole('button', { name: /War Room/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'War Room' })).toBeVisible();

    await page.getByLabel('Title').fill(questTitle);
    await page.getByRole('textbox', { name: 'Description' }).fill('Add a dark/light theme toggle.');
    // AC inputs — use getByRole('textbox') scoped to the AC fieldset to avoid matching remove buttons
    await page.getByRole('textbox', { name: 'Criterion 1' }).fill('Toggle switches theme immediately');
    await page.getByRole('button', { name: /\+ Add Criterion/i }).click();
    await page.getByRole('textbox', { name: 'Criterion 2' }).fill('Preference persists across reloads');

    await page.getByRole('button', { name: /^Draft Quest$/ }).click();

    await expect(page.getByText('Quest drafted! It now appears on the Quest Board.')).toBeVisible();

    // Close the War Room dialog
    await page.keyboard.press('Escape');

    // Open Town Square and verify quest is on the board (use first() in case of multiple runs)
    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(questTitle).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Drafted').first()).toBeVisible();
  });

  test('War Room draft form has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /War Room/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('persistence: adventurer and quest survive page reload', async ({ page }) => {
    const suffix = Date.now();
    const heroName = `Hero ${suffix}`;
    const questName = `Quest ${suffix}`;

    // Recruit a unique adventurer
    await page.goto('/');
    await page.getByRole('button', { name: /Town Square/i }).click();
    await page.getByRole('button', { name: /Recruit an Adventurer/i }).click();
    await page.getByLabel('Name').fill(heroName);
    await page.getByLabel('Class').selectOption('scout');
    await page.getByRole('button', { name: /^Recruit$/ }).click();
    await expect(page.getByText('Adventurer recruited! Welcome to the guild.')).toBeVisible();
    await page.keyboard.press('Escape');

    // Draft a unique quest
    await page.getByRole('button', { name: /War Room/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Title').fill(questName);
    await page.getByRole('button', { name: /^Draft Quest$/ }).click();
    await expect(
      page.getByText('Quest drafted! It now appears on the Quest Board.'),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // Reload and verify persistence
    await page.reload();

    await page.getByRole('button', { name: /Town Square/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(heroName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(questName)).toBeVisible({ timeout: 5000 });
  });
});
