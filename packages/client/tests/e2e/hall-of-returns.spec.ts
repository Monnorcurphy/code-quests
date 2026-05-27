import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MOCK_RETURNED_PAGE = {
  items: [
    {
      id: 'q1',
      epicId: null,
      title: 'Slay the Dragon',
      description: 'Defeat the ancient dragon terrorizing the village',
      acceptanceCriteria: ['Dragon defeated', 'Village saved'],
      edgeCases: [],
      context: '',
      status: 'complete',
      adventurerId: 'adv-1',
      agentId: 'ag-1',
      failureSummary: null,
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T11:00:00.000Z',
      adventurer: { id: 'adv-1', name: 'Aldric', class: 'champion' },
      agent: {
        id: 'ag-1',
        startedAt: '2024-01-01T10:00:00.000Z',
        endedAt: '2024-01-01T10:30:00.000Z',
        events: [
          { type: 'progress', timestamp: '2024-01-01T10:01:00.000Z', message: 'Entered the cave' },
          { type: 'combat', timestamp: '2024-01-01T10:10:00.000Z', message: 'Battle joined' },
          { type: 'completed', timestamp: '2024-01-01T10:30:00.000Z' },
        ],
      },
    },
    {
      id: 'q2',
      epicId: null,
      title: 'Retrieve the Artifact',
      description: 'Recover the lost artifact from the dungeon',
      acceptanceCriteria: ['Artifact retrieved'],
      edgeCases: [],
      context: '',
      status: 'failed',
      adventurerId: 'adv-2',
      agentId: 'ag-2',
      failureSummary: {
        reason: 'The dungeon was sealed',
        recommendation: 'repost_with_clarification',
      },
      createdAt: '2024-01-02T10:00:00.000Z',
      updatedAt: '2024-01-02T10:45:00.000Z',
      adventurer: { id: 'adv-2', name: 'Mira', class: 'rogue' },
      agent: {
        id: 'ag-2',
        startedAt: '2024-01-02T10:00:00.000Z',
        endedAt: '2024-01-02T10:45:00.000Z',
        events: [
          { type: 'progress', timestamp: '2024-01-02T10:05:00.000Z', message: 'Entered the dungeon' },
          { type: 'failed', timestamp: '2024-01-02T10:45:00.000Z', reason: 'Sealed' },
        ],
      },
    },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

test.describe('Hall of Returns', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/quests/returned*', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RETURNED_PAGE),
      });
    });
  });

  test('populated list view has no accessibility violations', async ({ page }) => {
    await page.goto('/town/hall-of-returns');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Slay the Dragon')).toBeVisible({ timeout: 5000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('detail modal has no accessibility violations', async ({ page }) => {
    await page.goto('/town/hall-of-returns');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Slay the Dragon')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /view details for slay the dragon/i }).click();
    await expect(page.getByRole('button', { name: /back to hall of returns/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
