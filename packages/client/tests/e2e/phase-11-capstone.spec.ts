import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Phase 11 Capstone — full 12-step showcase walkthrough E2E
//
// All API calls are mocked so this runs headlessly without a seeded DB.
// Demo mode is enabled via window.__DEMO_MODE__ (set in addInitScript).
// ---------------------------------------------------------------------------

const QUEST_JWT = 'quest-showcase-jwt';
const QUEST_COPY = 'quest-showcase-copy';
const QUEST_METER = 'quest-showcase-meter';
const QUEST_JWT_V2 = 'quest-showcase-jwt-v2';
const ADV_BRIELLE = 'adv-showcase-brielle';
const ADV_TESS = 'adv-showcase-tess';
const ADV_ROOK = 'adv-showcase-rook';

const MOCK_ADVENTURERS = [
  {
    id: ADV_BRIELLE,
    name: 'Brielle the Bold',
    class: 'champion',
    modelId: 'claude-opus-4-7',
    createdAt: '2026-05-01T00:00:00.000Z',
    stats: { questsWon: 8, monstersSlain: { goblin_linter: 8, imp_typecheck: 4 } },
    specializations: ['type_safety', 'refactoring'],
    scars: [],
  },
  {
    id: ADV_TESS,
    name: 'Tess the Tenacious',
    class: 'scout',
    modelId: 'claude-haiku-4-5-20251001',
    createdAt: '2026-05-01T00:00:00.000Z',
    stats: { questsWon: 2, monstersSlain: { goblin_linter: 2 } },
    specializations: ['frontend', 'copy_editing'],
    scars: [
      {
        questId: 'quest-demo-pre-scar',
        failureSummary: 'AC mismatch caused failure on a prior auth task',
        monsterIdAtFatal: 'the-jwt-hydra',
        occurredAt: '2026-04-24T10:30:00.000Z',
      },
    ],
  },
  {
    id: ADV_ROOK,
    name: 'Rook the Resolute',
    class: 'scout',
    modelId: 'claude-haiku-4-5-20251001',
    createdAt: '2026-05-01T00:00:00.000Z',
    stats: { questsWon: 0, monstersSlain: {} },
    specializations: [],
    scars: [],
  },
];

const BASE_QUESTS = [
  {
    id: QUEST_JWT,
    epicId: 'epic-showcase-auth',
    title: 'Migrate to JWT',
    description: 'Replace session-cookie auth with JWT tokens.',
    acceptanceCriteria: [
      'All API endpoints accept and validate JWT Bearer tokens',
      'JWT expiry is enforced server-side with a 15-minute TTL',
    ],
    edgeCases: ['Users with in-flight requests lose their session'],
    context: 'See ADR-12 for the JWT library decision.',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    currentScene: 'quest-forest',
    specAudit: null,
    equipment: { skillIds: ['type_whisperer'], toolIds: [], mcpServerIds: [] },
    failureSummary: null,
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
  },
  {
    id: QUEST_COPY,
    epicId: 'epic-showcase-auth',
    title: 'Update login form copy',
    description: 'Update user-facing copy to match brand voice guidelines.',
    acceptanceCriteria: ['All button labels use sentence case'],
    edgeCases: ['Screen-reader users relying on existing aria-labels'],
    context: 'Brand voice guidelines are in Notion.',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    currentScene: 'quest-forest',
    specAudit: null,
    equipment: { skillIds: ['linters_bane'], toolIds: [], mcpServerIds: [] },
    failureSummary: null,
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
  },
  {
    id: QUEST_METER,
    epicId: 'epic-showcase-auth',
    title: 'Add password strength meter',
    description: 'Add a visual password strength indicator.',
    acceptanceCriteria: ['Strength meter renders with four levels'],
    edgeCases: ['Mobile keyboards that hide the password'],
    context: 'Use zxcvbn for strength scoring.',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    currentScene: 'quest-forest',
    specAudit: null,
    equipment: { skillIds: ['wraith_banisher'], toolIds: [], mcpServerIds: [] },
    failureSummary: null,
    createdAt: '2026-05-28T10:00:00.000Z',
    updatedAt: '2026-05-28T10:00:00.000Z',
  },
];

const MOCK_SKILLS = [
  {
    id: 'linters_bane',
    name: "Linter's Bane",
    description: 'Slays lint errors on sight',
    status: 'active',
    hitCount: 11,
    monsterTypeIds: ['goblin_linter', 'imp_typecheck'],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'type_whisperer',
    name: 'Type Whisperer',
    description: 'Resolves TypeScript type errors',
    status: 'active',
    hitCount: 7,
    monsterTypeIds: ['imp_typecheck'],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'wraith_banisher',
    name: 'Wraith Banisher',
    description: 'Banishes flaky tests',
    status: 'active',
    hitCount: 3,
    monsterTypeIds: ['wraith_flaky_test'],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'ac_cartographer',
    name: 'AC Cartographer',
    description: 'Maps acceptance criteria mismatches',
    status: 'candidate',
    hitCount: 2,
    monsterTypeIds: ['hydra_ac_mismatch'],
    createdAt: '2026-05-01T00:00:00.000Z',
  },
];

const MOCK_EPIC = {
  id: 'epic-showcase-auth',
  title: 'Modernize the Auth System',
  goal: 'Migrate authentication infrastructure to modern JWT-based approach',
  createdAt: '2026-05-28T10:00:00.000Z',
};

const MOCK_AUTO_MATCH = {
  adventurerId: ADV_BRIELLE,
  adventurerName: 'Brielle the Bold',
  adventurerClass: 'champion',
  reason: 'type_safety specialization + 8 prior wins',
};

const MOCK_JWT_FAILED = {
  ...BASE_QUESTS[0],
  status: 'returned_to_town',
  adventurerId: ADV_BRIELLE,
  agentId: 'agent-brielle',
  equipment: { skillIds: ['type_whisperer'], toolIds: [], mcpServerIds: [] },
  adventurer: { id: ADV_BRIELLE, name: 'Brielle the Bold', class: 'champion' },
  fatalMonster: null,
  failureSummary: {
    reason: 'Lich of Repeated Failures rose after 3 type errors.',
    recommendation: 'repost_with_clarification',
    fatalEncounterId: 'enc-lich-brielle',
    retries: 2,
    notes: 'Equip type_whisperer on the next attempt.',
  },
};

const MOCK_JWT_COMPLETED = {
  ...BASE_QUESTS[0],
  id: QUEST_JWT_V2,
  title: 'Migrate to JWT (v2)',
  status: 'complete',
  adventurerId: ADV_BRIELLE,
  agentId: 'agent-brielle-v2',
  equipment: { skillIds: ['type_whisperer', 'linters_bane'], toolIds: [], mcpServerIds: [] },
  adventurer: { id: ADV_BRIELLE, name: 'Brielle the Bold', class: 'champion' },
  fatalMonster: null,
  failureSummary: null,
};

const MOCK_FINAL_COMPLETED = [
  { ...BASE_QUESTS[1], status: 'complete', adventurerId: ADV_TESS, adventurer: { id: ADV_TESS, name: 'Tess the Tenacious', class: 'scout' }, fatalMonster: null, failureSummary: null, equipment: BASE_QUESTS[1].equipment },
  { ...BASE_QUESTS[2], status: 'complete', adventurerId: ADV_ROOK, adventurer: { id: ADV_ROOK, name: 'Rook the Resolute', class: 'scout' }, fatalMonster: null, failureSummary: null, equipment: BASE_QUESTS[2].equipment },
  MOCK_JWT_COMPLETED,
];

async function setupBaseMocks(page: Parameters<typeof test.fn>[0]['page']) {
  await page.route('**/adventurers', (route) => {
    if (route.request().method() === 'GET' && !route.request().url().includes('/adventurers/')) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_ADVENTURERS) });
    } else {
      route.continue();
    }
  });
  await page.route(`**/adventurers/${ADV_BRIELLE}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_ADVENTURERS[0]) }),
  );
  await page.route(`**/adventurers/${ADV_TESS}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_ADVENTURERS[1]) }),
  );
  await page.route(`**/adventurers/${ADV_ROOK}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_ADVENTURERS[2]) }),
  );
  await page.route('**/epics', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([MOCK_EPIC]) }),
  );
  await page.route('**/skills**', (route) => {
    const url = route.request().url();
    if (url.includes('status=candidate')) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_SKILLS.filter((s) => s.status === 'candidate')) });
    } else if (url.includes('status=active')) {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_SKILLS.filter((s) => s.status === 'active')) });
    } else {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_SKILLS) });
    }
  });
  await page.route('**/monsters**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
  );
  await page.route('**/monster-types**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
  );
  await page.route('**/tools', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
  );
  await page.route('**/mcp-servers', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
  );
}

test.describe('Phase 11 capstone — full 12-step showcase walkthrough', () => {
  test.beforeEach(async ({ page }) => {
    // Enable demo mode for this test without CODE_QUESTS_ENV at build time
    await page.addInitScript(() => {
      (window as Record<string, unknown>)['__DEMO_MODE__'] = true;
    });
    await setupBaseMocks(page);

    // Mock POST /showcase/reset
    await page.route('**/showcase/reset', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ epicId: 'epic-showcase-auth' }),
        });
      } else {
        route.continue();
      }
    });

    // Mock quest list (idle state initially)
    await page.route('**/quests', (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('/quests/')) {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(BASE_QUESTS) });
      } else {
        route.continue();
      }
    });
    await page.route('**/quests/active', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route('**/hall-of-returns/quests**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [], nextCursor: null, total: 0 }),
      }),
    );
    for (const q of BASE_QUESTS) {
      await page.route(`**/quests/${q.id}`, (route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(q) }),
      );
      await page.route(`**/quests/${q.id}/auto-match`, (route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_AUTO_MATCH) }),
      );
    }
  });

  test('Step 1 — Town Square shows Showcase Demo button in demo mode', async ({ page }) => {
    await page.goto('/town/town-square');
    await page.waitForSelector('canvas, .phaser-scene-canvas', { timeout: 10000 }).catch(() => {});

    // Open Town Square panel
    const sceneNav = page.locator('nav[aria-label="Scene interactions"]');
    const questBoard = sceneNav.locator('button', { hasText: 'Quest Board' });
    const hasNav = await questBoard.isVisible().catch(() => false);
    if (hasNav) {
      await questBoard.click({ force: true });
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
    }

    // Start Showcase Demo button must be visible
    const showcaseBtn = page.getByTestId('showcase-start-btn');
    await expect(showcaseBtn).toBeVisible({ timeout: 5000 });

    // Axe-core scan: step 1
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations).toEqual([]);
  });

  test('Click Start Showcase Demo → confirm modal → tour starts', async ({ page }) => {
    await page.goto('/town/town-square');
    await page.waitForSelector('canvas, .phaser-scene-canvas', { timeout: 10000 }).catch(() => {});

    // Open Town Square panel
    const sceneNav = page.locator('nav[aria-label="Scene interactions"]');
    const questBoard = sceneNav.locator('button', { hasText: 'Quest Board' });
    const hasNav = await questBoard.isVisible().catch(() => false);
    if (hasNav) {
      await questBoard.click({ force: true });
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
    }

    await page.getByTestId('showcase-start-btn').click();

    // Confirmation modal must appear
    const modal = page.getByTestId('showcase-confirm-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(modal.getByText(/reset your database/i)).toBeVisible();

    // Confirm
    await modal.getByRole('button', { name: /start demo/i }).click();

    // Tour overlay should appear at step 1
    const tour = page.getByTestId('tour-overlay');
    await expect(tour).toBeVisible({ timeout: 5000 });
    await expect(tour.getByText(/step 1 of 12/i)).toBeVisible();
    await expect(tour.getByText(/Town Square/i)).toBeVisible();
  });

  test('Tour overlay — advance through all 12 steps', async ({ page }) => {
    await page.goto('/town/town-square');
    await page.waitForSelector('canvas, .phaser-scene-canvas', { timeout: 10000 }).catch(() => {});

    // Mock quests for quest routes visited during tour
    await page.route(`**/quests/${QUEST_COPY}`, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(BASE_QUESTS[1]) }),
    );
    await page.route(`**/quests/${QUEST_METER}`, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(BASE_QUESTS[2]) }),
    );
    await page.route(`**/quests/${QUEST_JWT}`, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(BASE_QUESTS[0]) }),
    );
    await page.route(`**/quests/${QUEST_JWT_V2}`, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_JWT_COMPLETED) }),
    );
    await page.route(`**/quests/${QUEST_JWT}/encounters`, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route(`**/quests/${QUEST_COPY}/encounters`, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route(`**/quests/${QUEST_METER}/encounters`, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
    );
    await page.route(`**/quests/${QUEST_JWT_V2}/encounters`, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
    );

    // Start tour programmatically via store
    await page.evaluate(() => {
      const store = (window as Record<string, unknown>)['__tourStore'] as
        | { getState: () => { startTour: () => void } }
        | undefined;
      store?.getState().startTour();
    });

    const tour = page.getByTestId('tour-overlay');
    await expect(tour).toBeVisible({ timeout: 5000 });

    // Advance through all 12 steps
    for (let step = 1; step <= 12; step++) {
      await expect(tour.getByText(new RegExp(`step ${step} of 12`, 'i'))).toBeVisible();

      if (step === 4) {
        // Axe-core scan at step 4
        const a11y = await new AxeBuilder({ page }).analyze();
        expect(a11y.violations).toEqual([]);
      }

      if (step === 7) {
        // Axe-core scan at step 7 (PAUSED_INPUT step)
        const a11y = await new AxeBuilder({ page }).analyze();
        expect(a11y.violations).toEqual([]);
      }

      if (step < 12) {
        await tour.getByRole('button', { name: /next/i }).click();
        await page.waitForTimeout(200);
      }
    }

    // At step 12, final step
    await expect(tour.getByText(/step 12 of 12/i)).toBeVisible();

    // Axe-core scan at step 12
    const a11yFinal = await new AxeBuilder({ page }).analyze();
    expect(a11yFinal.violations).toEqual([]);

    // Finish tour
    await tour.getByRole('button', { name: /finish tour/i }).click();
    await expect(tour).not.toBeVisible({ timeout: 3000 });
  });

  test('Tour overlay — ESC dismisses', async ({ page }) => {
    await page.goto('/town/town-square');

    await page.evaluate(() => {
      const store = (window as Record<string, unknown>)['__tourStore'] as
        | { getState: () => { startTour: () => void } }
        | undefined;
      store?.getState().startTour();
    });

    const tour = page.getByTestId('tour-overlay');
    await expect(tour).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(tour).not.toBeVisible({ timeout: 3000 });
  });

  test('Tour overlay — Back button works', async ({ page }) => {
    await page.goto('/town/town-square');

    await page.evaluate(() => {
      const store = (window as Record<string, unknown>)['__tourStore'] as
        | { getState: () => { startTour: () => void } }
        | undefined;
      store?.getState().startTour();
    });

    const tour = page.getByTestId('tour-overlay');
    await expect(tour).toBeVisible({ timeout: 5000 });
    await expect(tour.getByText(/step 1 of 12/i)).toBeVisible();

    // Advance to step 2
    await tour.getByRole('button', { name: /next/i }).click();
    await page.waitForTimeout(200);
    await expect(tour.getByText(/step 2 of 12/i)).toBeVisible();

    // Back to step 1
    await tour.getByRole('button', { name: /back/i }).click();
    await page.waitForTimeout(200);
    await expect(tour.getByText(/step 1 of 12/i)).toBeVisible();

    // No "Back" on step 1
    await expect(tour.getByRole('button', { name: /back/i })).not.toBeVisible();
  });

  test('Showcase /reset returns 403 outside demo mode (stub verification)', async ({ page }) => {
    // Override the route to return 403 as the real server would
    await page.route('**/showcase/reset', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Showcase reset is only available in demo mode' }),
      });
    });

    await page.goto('/town/town-square');
    const sceneNav = page.locator('nav[aria-label="Scene interactions"]');
    const questBoard = sceneNav.locator('button', { hasText: 'Quest Board' });
    const hasNav = await questBoard.isVisible().catch(() => false);
    if (hasNav) {
      await questBoard.click({ force: true });
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
    }

    await page.getByTestId('showcase-start-btn').click();
    const modal = page.getByTestId('showcase-confirm-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await modal.getByRole('button', { name: /start demo/i }).click();

    // Error should be shown in the modal
    await expect(modal.getByText(/demo mode/i)).toBeVisible({ timeout: 3000 });

    // Tour should not have started
    await expect(page.getByTestId('tour-overlay')).not.toBeVisible();
  });

  test('Hall of Returns — completed quests visible at step 12', async ({ page }) => {
    await page.route('**/hall-of-returns/quests**', (route) => {
      const url = route.request().url();
      if (url.includes('status=complete')) {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ items: MOCK_FINAL_COMPLETED, nextCursor: null, total: 3 }),
        });
      } else {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ items: [], nextCursor: null, total: 0 }),
        });
      }
    });

    await page.goto('/town/hall-of-returns');
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});

    // Switch to completed tab
    const completedTab = page.getByRole('tab', { name: /completed/i });
    const tabVisible = await completedTab.isVisible().catch(() => false);
    if (tabVisible) {
      await completedTab.click();
      await page.waitForTimeout(400);
    }

    // All 3 completed quests visible
    await expect(page.getByText(/Migrate to JWT/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Update login form copy/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Add password strength meter/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('Showcase button is hidden when not in demo mode', async ({ page }) => {
    // Do NOT set __DEMO_MODE__ in this test — override the beforeEach init
    await page.addInitScript(() => {
      delete (window as Record<string, unknown>)['__DEMO_MODE__'];
    });

    await page.goto('/town/town-square');
    await page.waitForSelector('canvas, .phaser-scene-canvas', { timeout: 10000 }).catch(() => {});

    const sceneNav = page.locator('nav[aria-label="Scene interactions"]');
    const questBoard = sceneNav.locator('button', { hasText: 'Quest Board' });
    const hasNav = await questBoard.isVisible().catch(() => false);
    if (hasNav) {
      await questBoard.click({ force: true });
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
    }

    const showcaseBtn = page.getByTestId('showcase-start-btn');
    await expect(showcaseBtn).not.toBeVisible({ timeout: 3000 });
  });
});
