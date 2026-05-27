import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// SceneKeyboardNav is a visually-hidden nav that exposes scene interactives to
// keyboard/screen-reader users. Buttons inside it are the hook for E2E tests.
const SCENE_NAV = 'nav[aria-label="Scene interactions"]';

async function waitForSceneNav(page: Parameters<typeof test.fn>[0]['page']) {
  await page.waitForSelector(`${SCENE_NAV} button`, { timeout: 15000 });
}

test.describe('Phase 1 capstone — end-to-end walkthrough (Phaser town)', () => {
  test('Town Square scene nav loads with expected interactives', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    // Quest Board and Recruit Banner are the two main interactives
    await expect(
      page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }),
    ).toBeAttached();
    await expect(
      page.locator(`${SCENE_NAV} button`, { hasText: 'Recruit Banner' }),
    ).toBeAttached();
  });

  test('Town page has no accessibility violations', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('recruit flow: adventurer appears in roster after recruiting', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    // Open Town Square panel via SceneKeyboardNav
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /Recruit an Adventurer/i }).click();
    await expect(page.getByLabel('Name')).toBeVisible();

    await page.getByLabel('Name').fill('Brielle the Bold');
    await page.getByLabel('Class').selectOption('champion');
    await page.getByRole('button', { name: /^Recruit$/ }).click();

    await expect(page.getByText('Adventurer recruited! Welcome to the guild.')).toBeVisible();
    await expect(page.getByText('Brielle the Bold').first()).toBeVisible({ timeout: 5000 });
  });

  test('Town Square dialog has no accessibility violations', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('quest draft flow: quest appears on Quest Board', async ({ page }) => {
    const questTitle = `Implement search functionality`;

    // Navigate to War Room and open the Planning Table
    await page.goto('/town/war-room');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Planning Table")`, {
      timeout: 15000,
    });
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'War Room' })).toBeVisible();

    await page.getByLabel('Title').fill(questTitle);
    await page.getByRole('textbox', { name: 'Description' }).fill('Add a search bar to the UI.');
    await page.getByRole('textbox', { name: 'Criterion 1' }).fill('Search returns results');
    await page.getByRole('button', { name: /\+ Add Criterion/i }).click();
    await page.getByRole('textbox', { name: 'Criterion 2' }).fill('Search is case-insensitive');

    await page.getByRole('button', { name: /^Draft Quest$/ }).click();

    await expect(
      page.getByText('Quest drafted! It now appears on the Quest Board.'),
    ).toBeVisible();

    // Close and navigate to town-square to verify quest on board
    await page.keyboard.press('Escape');

    await page.goto('/town/town-square');
    await waitForSceneNav(page);
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(questTitle).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Drafted').first()).toBeVisible();
  });

  test('War Room draft form has no accessibility violations', async ({ page }) => {
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

  test('persistence: adventurer and quest survive page reload', async ({ page }) => {
    const suffix = Date.now();
    const heroName = `Hero ${suffix}`;
    const questName = `Quest ${suffix}`;

    // Recruit a unique adventurer
    await page.goto('/town/town-square');
    await waitForSceneNav(page);
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await page.getByRole('button', { name: /Recruit an Adventurer/i }).click();
    await page.getByLabel('Name').fill(heroName);
    await page.getByLabel('Class').selectOption('scout');
    await page.getByRole('button', { name: /^Recruit$/ }).click();
    await expect(page.getByText('Adventurer recruited! Welcome to the guild.')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Draft a unique quest
    await page.goto('/town/war-room');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Planning Table")`, {
      timeout: 15000,
    });
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Title').fill(questName);
    await page.getByRole('button', { name: /^Draft Quest$/ }).click();
    await expect(
      page.getByText('Quest drafted! It now appears on the Quest Board.'),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // Reload and verify persistence
    await page.goto('/town/town-square');
    await waitForSceneNav(page);
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(heroName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(questName)).toBeVisible({ timeout: 5000 });
  });
});
