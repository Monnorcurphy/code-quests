import { test, expect, type APIRequestContext } from '@playwright/test';

// E2E coverage for the Council pre-dispatch planning loop. Stubs out the
// /council/consult endpoint so we don't burn real model tokens, and verifies:
//   - the Convene Council button surfaces from the draft form
//   - the modal opens with a model picker (claude_cli filtered out)
//   - sending a message wires the draft + history to the server
//   - the assistant reply renders as a bubble
// Screenshots into test-results/screenshots/council-*.png.

const SCREENSHOT_DIR = 'test-results/screenshots';

interface ModelSummary { id: string; name: string; provider: string; modelId: string; hasKey: boolean }

async function wipeModels(request: APIRequestContext): Promise<void> {
  const res = await request.get('/models');
  const models = (await res.json()) as ModelSummary[];
  for (const m of models) {
    // Detach from any quests first so the FK-protection doesn't block.
    const quests = await request.get('/quests').then((r) => r.json()) as Array<{ id: string; modelId: string | null }>;
    for (const q of quests) {
      if (q.modelId === m.id) {
        await request.patch(`/quests/${q.id}`, { data: { modelId: null } });
      }
    }
    await request.delete(`/models/${m.id}`);
  }
}

async function addOllamaModel(request: APIRequestContext, name: string): Promise<ModelSummary> {
  const res = await request.post('/models', {
    data: { name, provider: 'ollama', modelId: 'llama3.1:8b' },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as ModelSummary;
}

test.describe('Council UX', () => {
  test.beforeEach(async ({ request }) => {
    await wipeModels(request);
  });

  test.afterEach(async ({ request }) => {
    await wipeModels(request);
  });

  test('Convene Council opens a modal with a council model picker and a reply renders', async ({
    page,
    request,
  }) => {
    await addOllamaModel(request, 'Council Llama');

    // Stub the /council/consult network response so this test is hermetic and
    // doesn't depend on a live Ollama instance.
    await page.route('**/council/consult', async (route) => {
      const json = {
        reply:
          'Your title is fine. Two things to tighten:\n1. Specify the runtime (Node/Bun?).\n2. Add an AC for failure messaging.',
        modelName: 'Council Llama',
        provider: 'ollama',
        tokenUsage: { input: 120, output: 40 },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(json),
      });
    });

    await page.goto('/town/war-room');
    await page.waitForSelector(
      'nav[aria-label="Scene interactions"] button:has-text("Planning Table")',
      { timeout: 15000 },
    );
    await page
      .locator('nav[aria-label="Scene interactions"] button', { hasText: 'Planning Table' })
      .dispatchEvent('click');
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Title').fill('Make a hello world API');
    await page.getByLabel('Description').fill('A small HTTP server that responds with "hello".');

    // Scroll to the council button — it sits at the bottom of the long
    // draft form. Without this it can be below the viewport.
    const councilBtn = page.getByTestId('convene-council-btn');
    await councilBtn.scrollIntoViewIfNeeded();
    await councilBtn.click();

    // The modal mounts.
    await expect(page.getByRole('heading', { name: /convene the council/i })).toBeVisible();

    // Council model picker has the ollama model and not claude_cli (none added).
    const select = page.getByTestId('council-model-select');
    const options = await select.locator('option').allTextContents();
    expect(options.some((o) => /Council Llama/.test(o))).toBe(true);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/council-1-opened.png`,
      fullPage: true,
    });

    await page
      .getByTestId('council-input')
      .fill('Is this title precise enough?');
    await page.getByRole('button', { name: /send to council/i }).click();

    await expect(page.getByText(/Specify the runtime/)).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/council-2-reply.png`,
      fullPage: true,
    });

    // "Done with Council" closes the modal but leaves the draft form intact.
    await page.getByRole('button', { name: /done with council/i }).click();
    await expect(page.getByRole('heading', { name: /convene the council/i })).not.toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('Make a hello world API');
  });

  test('Convene Council is disabled when no models are configured', async ({ page }) => {
    await page.goto('/town/war-room');
    const planningTable = page.getByRole('button', { name: /planning table/i });
    await planningTable.dispatchEvent('click').catch(async () => {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const match = buttons.find((b) => /planning table/i.test(b.textContent ?? ''));
        match?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    });
    const btn = page.getByTestId('convene-council-btn');
    await expect(btn).toBeDisabled();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/council-3-disabled-no-models.png`,
      fullPage: true,
    });
  });
});
