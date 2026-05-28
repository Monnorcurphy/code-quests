import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Party Map — accessibility', () => {
  test('party map banner (collapsed) has no axe violations', async ({ page }) => {
    await page.goto('/town/town-square');
    await page.getByRole('button', { name: /party map/i }).waitFor({ timeout: 15000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('party map banner (expanded) has no axe violations', async ({ page }) => {
    await page.goto('/town/town-square');
    const banner = page.getByRole('button', { name: /party map/i });
    await banner.waitFor({ timeout: 15000 });
    await banner.click();
    await page.getByRole('region', { name: /active quests/i }).waitFor({ timeout: 5000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
