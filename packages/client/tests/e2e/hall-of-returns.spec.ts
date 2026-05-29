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

const MOCK_POST_MORTEM = {
  quest: {
    id: 'q1',
    epicId: null,
    title: 'Slay the Dragon',
    description: 'Defeat the ancient dragon terrorizing the village',
    acceptanceCriteria: ['Dragon defeated', 'Village saved'],
    edgeCases: [],
    context: '',
    status: 'returned_to_town',
    adventurerId: 'adv-1',
    agentId: 'ag-1',
    failureSummary: {
      reason: 'The dragon was too powerful',
      recommendation: 'repost_with_clarification',
      notes: 'Try a different approach.',
      retries: 1,
    },
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T11:00:00.000Z',
    adventurer: { id: 'adv-1', name: 'Aldric', class: 'champion' },
    fatalMonster: {
      monsterId: 'monster-1',
      monsterName: 'Shadow Drake',
      spritePath: '/sprites/drake.png',
      difficulty: 3,
    },
  },
  attempts: [
    {
      id: 'attempt-1',
      startedAt: '2024-01-01T10:00:00.000Z',
      endedAt: '2024-01-01T10:30:00.000Z',
      events: [],
    },
  ],
  encounters: [
    {
      id: 'enc-1',
      monsterId: 'monster-1',
      questId: 'q1',
      appearedAt: '2024-01-01T10:05:00.000Z',
      combatLog: ['The dragon breathes fire!', 'You dodge narrowly.'],
      outcome: 'defeat',
      loot: [],
      resolvedAt: '2024-01-01T10:10:00.000Z',
      monsterName: 'Shadow Drake',
      spritePath: '/sprites/drake.png',
      difficulty: 3,
    },
  ],
  failureSummary: {
    reason: 'The dragon was too powerful',
    recommendation: 'repost_with_clarification',
    notes: 'Try a different approach.',
    retries: 1,
  },
  adventurer: { id: 'adv-1', name: 'Aldric', class: 'champion' },
};

test.describe('Post-Mortem page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/hall-of-returns/quests/*/post-mortem', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(MOCK_POST_MORTEM),
      });
    });
  });

  test('loaded post-mortem has no accessibility violations', async ({ page }) => {
    await page.goto('/hall-of-returns/q1');
    await expect(page.getByRole('heading', { name: /slay the dragon/i })).toBeVisible({ timeout: 10000 });

    // Expand a combat-log row so conditionally-rendered details are in the DOM during the scan
    const encounterRow = page.getByRole('button', { name: /shadow drake/i }).first();
    if (await encounterRow.isVisible()) {
      await encounterRow.click();
    }

    const results = await new AxeBuilder({ page }).include('main').analyze();
    expect(results.violations).toEqual([]);
  });

  test('error state has no accessibility violations', async ({ page }) => {
    await page.route('**/hall-of-returns/quests/*/post-mortem', (route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) });
    });
    await page.goto('/hall-of-returns/q1');
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page }).include('main').analyze();
    expect(results.violations).toEqual([]);
  });
});

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
