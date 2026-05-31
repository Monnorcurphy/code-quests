import { test, expect, type APIRequestContext } from '@playwright/test';

// E2E coverage for the Oracle + Tavern room advisors. Stubs /advisors/
// :kind/consult so the test is hermetic.

const SCREENSHOT_DIR = 'test-results/screenshots';

interface ModelSummary {
  id: string; name: string; provider: string; modelId: string; hasKey: boolean;
}

async function wipeModels(request: APIRequestContext): Promise<void> {
  const models = (await request.get('/models').then((r) => r.json())) as ModelSummary[];
  for (const m of models) {
    const quests = (await request.get('/quests').then((r) => r.json())) as Array<{
      id: string; modelId: string | null;
    }>;
    for (const q of quests) {
      if (q.modelId === m.id) {
        await request.patch(`/quests/${q.id}`, { data: { modelId: null } });
      }
    }
    await request.delete(`/models/${m.id}`);
  }
}

async function ensureOllamaModel(request: APIRequestContext): Promise<ModelSummary> {
  const list = (await request.get('/models').then((r) => r.json())) as ModelSummary[];
  const existing = list.find((m) => m.provider === 'ollama');
  if (existing) return existing;
  const res = await request.post('/models', {
    data: { name: 'Test Llama', provider: 'ollama', modelId: 'llama3.1:8b' },
  });
  return (await res.json()) as ModelSummary;
}

async function createIdleQuest(
  request: APIRequestContext,
  partial: { title: string; description?: string; acceptanceCriteria?: string[] },
): Promise<{ id: string }> {
  const res = await request.post('/quests', {
    data: {
      title: partial.title,
      description: partial.description ?? '',
      acceptanceCriteria: partial.acceptanceCriteria ?? [],
    },
  });
  return (await res.json()) as { id: string };
}

test.describe('Room advisors', () => {
  test.beforeEach(async ({ request }) => {
    await wipeModels(request);
  });
  test.afterEach(async ({ request }) => {
    await wipeModels(request);
  });

  test('Oracle: Consult Seer Caelis applies AC refinements to the editor', async ({
    page, request,
  }) => {
    await ensureOllamaModel(request);
    const quest = await createIdleQuest(request, {
      title: 'Hello world page',
      description: 'A page that loads.',
      acceptanceCriteria: ['It says hello world'],
    });

    // Stub the advisors endpoint.
    await page.route('**/advisors/oracle/consult', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'Sharpen "centred" — vertical and horizontal both.',
          modelName: 'Test Llama',
          provider: 'ollama',
          kind: 'oracle',
          npcName: 'Seer Caelis',
          npcRole: 'Priestess of the Oracle',
          proposedRefinements: {
            acceptanceCriteria: [
              'The page renders the text "Hello world"',
              'The text is centred horizontally AND vertically in the viewport',
              'The background is #2563eb',
            ],
          },
        }),
      });
    });

    await page.goto('/town/oracle');
    await page.waitForSelector('nav[aria-label="Scene interactions"]', { timeout: 15000 });
    await page
      .locator('nav[aria-label="Scene interactions"] button', { hasText: 'Crystal Ball' })
      .dispatchEvent('click');

    await expect(page.getByRole('dialog')).toBeVisible();
    // Modal opens with QuestSelector (no quest picked yet). Pick our quest.
    const selector = page.getByLabel(/Sharpen which quest/i);
    await selector.selectOption(quest.id);

    // Now AC inputs appear.
    await page.waitForSelector('input[aria-label="Criterion 1"]', { timeout: 5000 });

    await page.getByTestId('consult-oracle-btn').click();
    await expect(page.getByRole('heading', { name: /consult seer caelis/i })).toBeVisible();

    // Wait for the auto-picked model.
    await expect(page.getByTestId('advisor-model-select')).toHaveValue(/.+/);

    await page.getByTestId('advisor-input').fill('any fog in these conditions?');
    await page.getByRole('button', { name: /consult the oracle/i }).click();

    await expect(page.getByText(/Sharpen "centred"/)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('advisor-proposal')).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/oracle-advisor-1-suggestion.png`,
      fullPage: true,
    });

    await page.getByTestId('apply-proposal-btn').click();
    await expect(page.getByTestId('apply-proposal-btn')).toBeDisabled();

    // Close the advisor — the Oracle modal should now show 3 AC inputs.
    await page.getByRole('button', { name: /^close$/i }).click();
    const ac1 = page.getByRole('textbox', { name: 'Criterion 1' });
    await expect(ac1).toHaveValue(/Hello world/);
    await expect(page.getByRole('textbox', { name: 'Criterion 2' })).toHaveValue(/centred/);
    await expect(page.getByRole('textbox', { name: 'Criterion 3' })).toHaveValue(/#2563eb/);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/oracle-advisor-2-applied.png`,
      fullPage: true,
    });
  });

  test('Tavern: Consult Innkeep Rorek applies edge-case refinements to the editor', async ({
    page, request,
  }) => {
    await ensureOllamaModel(request);
    const quest = await createIdleQuest(request, {
      title: 'Hello world page',
      acceptanceCriteria: ['Says hello world'],
    });

    await page.route('**/advisors/tavern/consult', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'A careful traveller would worry about these…',
          modelName: 'Test Llama',
          provider: 'ollama',
          kind: 'tavern',
          npcName: 'Innkeep Rorek',
          npcRole: 'Tavernkeeper',
          proposedRefinements: {
            edgeCases: [
              'Browser cache returns stale HTML on the second visit',
              'Page is opened with file:// — relative paths break',
              'Window resized below 320px — text overflows',
            ],
          },
        }),
      });
    });

    await page.goto('/town/tavern');
    await page.waitForSelector('nav[aria-label="Scene interactions"]', { timeout: 15000 });
    await page
      .locator('nav[aria-label="Scene interactions"] button', { hasText: 'Ale Barrel' })
      .dispatchEvent('click');

    await expect(page.getByRole('dialog')).toBeVisible();
    const selector = page.getByLabel(/Talk over which quest/i);
    await selector.selectOption(quest.id);
    await page.waitForSelector('input[aria-label="Edge case 1"]', { timeout: 5000 });

    await page.getByTestId('consult-tavern-btn').click();
    await expect(page.getByRole('heading', { name: /consult innkeep rorek/i })).toBeVisible();
    await expect(page.getByTestId('advisor-model-select')).toHaveValue(/.+/);

    await page.getByTestId('advisor-input').fill('what traps am I missing?');
    await page.getByRole('button', { name: /ask rorek/i }).click();
    await expect(page.getByText(/careful traveller would worry/)).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/tavern-advisor-1-suggestion.png`,
      fullPage: true,
    });

    await page.getByTestId('apply-proposal-btn').click();
    await page.getByRole('button', { name: /^close$/i }).click();

    await expect(page.getByRole('textbox', { name: 'Edge case 1' })).toHaveValue(/cache returns stale/);
    await expect(page.getByRole('textbox', { name: 'Edge case 2' })).toHaveValue(/file:\/\//);
    await expect(page.getByRole('textbox', { name: 'Edge case 3' })).toHaveValue(/320px/);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/tavern-advisor-2-applied.png`,
      fullPage: true,
    });
  });
});
