import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Phase 2 capstone: pixel-art Phaser town end-to-end walkthrough.
// SceneKeyboardNav exposes all in-scene interactives to keyboard/screen-reader users —
// these hidden buttons are the primary hook for E2E interactions.

const SCENE_NAV = 'nav[aria-label="Scene interactions"]';
const REDUCED_MOTION_KEY = 'code-quests:reduced-motion';

async function waitForScene(page: Parameters<typeof test.fn>[0]['page'], buttonLabel: string) {
  await page.waitForSelector(`${SCENE_NAV} button:has-text("${buttonLabel}")`, {
    timeout: 15000,
  });
}

test.describe('Phase 2 capstone — Phaser pixel-art town walkthrough', () => {
  test('browser opens to /town/town-square and scene loads', async ({ page }) => {
    await page.goto('/');
    // Root redirects to /town/town-square
    await page.waitForURL('**/town/town-square');
    await waitForScene(page, 'Quest Board');

    // Aria-live heading announces the scene
    await expect(page.getByText('Town Square').first()).toBeAttached();
  });

  test('Town Square scene has no accessibility violations', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('recruit via Recruit Banner: adventurer appears in Guild Hall', async ({ page }) => {
    const heroName = `Hero-P2-${Date.now()}`;

    await page.goto('/town/town-square');
    await waitForScene(page, 'Recruit Banner');

    // Activate recruit directly via recruit banner
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Recruit Banner' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Name').fill(heroName);
    await page.getByLabel('Class').selectOption('champion');
    await page.getByRole('button', { name: /^Recruit$/ }).click();

    await expect(page.getByText('Adventurer recruited! Welcome to the guild.')).toBeVisible();
    await expect(page.getByText(heroName).first()).toBeVisible({ timeout: 5000 });

    // Close modal
    await page.keyboard.press('Escape');

    // Navigate to Guild Hall and verify adventurer in roster
    await page.goto('/town/guild-hall');
    await waitForScene(page, 'Guild Roster');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Guild Roster' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(heroName).first()).toBeVisible({ timeout: 5000 });
  });

  test('recruit modal has no accessibility violations', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForScene(page, 'Recruit Banner');

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Recruit Banner' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('War Room: draft quest appears on Quest Board', async ({ page }) => {
    const questTitle = `Phase-2-Quest-${Date.now()}`;

    await page.goto('/town/war-room');
    await waitForScene(page, 'Planning Table');

    await page.locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Title').fill(questTitle);
    await page.getByRole('textbox', { name: 'Description' }).fill('A quest created in Phase 2.');
    await page.getByRole('textbox', { name: 'Criterion 1' }).fill('Feature works end-to-end');
    await page.getByRole('button', { name: /\+ Add Criterion/i }).click();
    await page.getByRole('textbox', { name: 'Criterion 2' }).fill('Tests pass');

    await page.getByRole('button', { name: /^Draft Quest$/ }).click();
    await expect(
      page.getByText('Quest drafted! It now appears on the Quest Board.'),
    ).toBeVisible();

    // Close and navigate to town square to verify quest on board
    await page.keyboard.press('Escape');

    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(questTitle).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Drafted').first()).toBeVisible();
  });

  test('War Room draft form has no accessibility violations', async ({ page }) => {
    await page.goto('/town/war-room');
    await waitForScene(page, 'Planning Table');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' }).click({
      force: true,
    });
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('Guild Hall has no accessibility violations', async ({ page }) => {
    await page.goto('/town/guild-hall');
    await waitForScene(page, 'Guild Roster');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Guild Roster' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('all 7 building door scene nav items are reachable from Town Square', async ({
    page,
  }) => {
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');

    const doors = [
      'War Room',
      'Oracle',
      'Library',
      'Tavern',
      'Armory',
      'Guild Hall',
      'Hall of Returns',
    ];
    for (const door of doors) {
      await expect(
        page.locator(`${SCENE_NAV} button`, { hasText: door }),
      ).toBeAttached();
    }
  });

  test('settings button is accessible and opens the settings panel', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');

    const settingsBtn = page.getByRole('button', { name: 'Open settings' });
    await expect(settingsBtn).toBeVisible();

    await settingsBtn.click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  });

  test('reduce motion toggle persists across reload', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');

    // Open settings and enable reduce motion
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

    const checkbox = page.getByLabel('Reduce motion');
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Verify localStorage was set
    const stored = await page.evaluate(
      (key) => localStorage.getItem(key),
      REDUCED_MOTION_KEY,
    );
    expect(stored).toBe('true');

    // Verify data-reduced-motion attribute was set
    const attr = await page.evaluate(() =>
      document.documentElement.getAttribute('data-reduced-motion'),
    );
    expect(attr).toBe('true');

    // Reload and verify preference persists
    await page.reload();
    await waitForScene(page, 'Quest Board');

    const attrAfterReload = await page.evaluate(() =>
      document.documentElement.getAttribute('data-reduced-motion'),
    );
    expect(attrAfterReload).toBe('true');

    // Re-open settings to confirm checkbox shows as checked
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByLabel('Reduce motion')).toBeChecked();
  });

  test('settings panel has no accessibility violations', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');

    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('state persists: adventurer and quest survive page reload', async ({ page }) => {
    const suffix = Date.now();
    const heroName = `P2-Hero-${suffix}`;
    const questName = `P2-Quest-${suffix}`;

    // Recruit
    await page.goto('/town/town-square');
    await waitForScene(page, 'Recruit Banner');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Recruit Banner' }).click({
      force: true,
    });
    await page.getByLabel('Name').fill(heroName);
    await page.getByLabel('Class').selectOption('scout');
    await page.getByRole('button', { name: /^Recruit$/ }).click();
    await expect(page.getByText('Adventurer recruited! Welcome to the guild.')).toBeVisible();
    await page.keyboard.press('Escape');

    // Draft quest
    await page.goto('/town/war-room');
    await waitForScene(page, 'Planning Table');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' }).click({
      force: true,
    });
    await page.getByLabel('Title').fill(questName);
    await page.getByRole('button', { name: /^Draft Quest$/ }).click();
    await expect(
      page.getByText('Quest drafted! It now appears on the Quest Board.'),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // Reload and verify everything persisted
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');
    await page.locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' }).click({ force: true });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(heroName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(questName)).toBeVisible({ timeout: 5000 });
  });

  test('URL stays synced after scene transitions', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForScene(page, 'Quest Board');

    // Navigate to War Room via scene nav door
    await page.locator(`${SCENE_NAV} button`, { hasText: 'War Room' }).click({ force: true });
    await page.waitForURL('**/town/war-room');
    expect(page.url()).toContain('/town/war-room');

    // Navigate back to Town Square via the return door
    await waitForScene(page, 'Return to Town Square');
    await page
      .locator(`${SCENE_NAV} button`, { hasText: 'Return to Town Square' })
      .click({ force: true });
    await page.waitForURL('**/town/town-square');
    expect(page.url()).toContain('/town/town-square');
  });
});
