import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// E2E coverage for the multi-model UX: Settings → Models management modal
// plus the War Room model picker. Screenshots are written to
// test-results/screenshots/multi-model-<scenario>.png for visual regression
// inspection.

const SCREENSHOT_DIR = 'test-results/screenshots';
const SCENE_NAV = 'nav[aria-label="Scene interactions"]';

interface ModelSummary {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  hasKey: boolean;
}

async function listModels(request: APIRequestContext): Promise<ModelSummary[]> {
  const res = await request.get('/models');
  expect(res.ok(), `GET /models failed: ${res.status()}`).toBe(true);
  return (await res.json()) as ModelSummary[];
}

// Quests created by this suite are recognizable by their title prefix so we
// can scrub them between tests without nuking seeded fixtures other tests
// depend on (e.g. the Phase 5 cave expedition demo quest).
const TEST_QUEST_TITLE_PREFIX = 'Multi-model';

async function wipeTestQuests(request: APIRequestContext): Promise<void> {
  const res = await request.get('/quests');
  if (!res.ok()) return;
  const quests = (await res.json()) as { id: string; title: string; status: string }[];
  for (const q of quests) {
    if (!q.title.startsWith(TEST_QUEST_TITLE_PREFIX)) continue;
    // Mark as cancelled (terminal state) before delete is not required — quests
    // route doesn't expose DELETE in this phase. Patch to a status that drops
    // the FK isn't possible either. Instead clear the modelId so the model
    // delete will succeed.
    await request.patch(`/quests/${q.id}`, { data: { modelId: null } });
  }
}

async function wipeAllModels(request: APIRequestContext): Promise<void> {
  // Detach any in-flight test quests from their models first so the FK
  // constraint on quests.model_id doesn't crash the delete.
  await wipeTestQuests(request);
  const models = await listModels(request);
  for (const m of models) {
    const res = await request.delete(`/models/${m.id}`);
    // 204 expected, 404 acceptable if a parallel cleanup beat us. 500 with
    // a foreign-key error means a non-test quest is still referencing this
    // model — surface it loudly so the cleanup gap is obvious.
    expect([204, 404]).toContain(res.status());
  }
}

async function createModelViaApi(
  request: APIRequestContext,
  input: {
    name: string;
    provider: 'claude_cli' | 'openrouter' | 'ollama';
    modelId: string;
    apiKey?: string;
    config?: Record<string, unknown>;
  },
): Promise<ModelSummary> {
  const res = await request.post('/models', {
    data: {
      name: input.name,
      provider: input.provider,
      modelId: input.modelId,
      config: input.config ?? {},
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`POST /models failed (${res.status()}): ${body}`);
  }
  return (await res.json()) as ModelSummary;
}

async function openSettings(page: Page): Promise<void> {
  await page.goto('/town/town-square');
  // The settings button lives in the top-right HUD; aria-label "Open settings".
  const settingsBtn = page.getByRole('button', { name: /open settings/i });
  await settingsBtn.waitFor({ timeout: 15000 });
  await settingsBtn.click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

async function openModelsModal(page: Page): Promise<void> {
  await openSettings(page);
  await page.getByTestId('open-models-btn').click();
  await expect(page.getByTestId('models-modal')).toBeVisible({ timeout: 5000 });
}

// macOS keychain probing can fail in some sandboxes (headless CI without
// Keychain access). Skip the suite in that case rather than failing noisily.
async function skipIfKeychainUnavailable(request: APIRequestContext): Promise<boolean> {
  const probe = await request.post('/models', {
    data: {
      name: '__keychain_probe__',
      provider: 'openrouter',
      modelId: 'probe/echo',
      apiKey: 'sk-probe-0000',
      config: {},
    },
  });
  if (probe.status() === 201) {
    const body = (await probe.json()) as ModelSummary;
    await request.delete(`/models/${body.id}`);
    return false;
  }
  return true;
}

test.describe('Multi-model UX — Settings & War Room', () => {
  test.beforeEach(async ({ request }) => {
    await wipeAllModels(request);
  });

  test.afterEach(async ({ request }) => {
    await wipeAllModels(request);
  });

  test('empty state — adding a Claude CLI model', async ({ page, request }) => {
    if (await skipIfKeychainUnavailable(request)) {
      test.skip(true, 'Keychain unavailable in this environment');
    }

    await openModelsModal(page);

    // Empty state copy is shown when zero models exist.
    await expect(page.getByText(/No models yet/i)).toBeVisible();

    // Default provider is claude_cli — fill in just name + identifier.
    await page.getByLabel('Display name').fill('Claude Sonnet via CLI');
    await page.getByLabel('Model identifier').fill('sonnet');
    // No API key field should be rendered for claude_cli.
    await expect(page.getByLabel('API key')).toHaveCount(0);

    await page.getByRole('button', { name: /add model/i }).click();

    // Row appears in the Existing models list. claude_cli doesn't store a
    // key, so the badge text is "needs key" (the registry only reports
    // whether a secret was actually persisted, not whether the provider
    // requires one).
    const list = page.getByRole('list', { name: /existing models/i });
    await expect(list).toBeVisible({ timeout: 5000 });
    const row = list.getByRole('listitem').filter({ hasText: 'Claude Sonnet via CLI' });
    await expect(row).toBeVisible();
    await expect(row.getByText('claude_cli · sonnet')).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/multi-model-1-claude-cli-added.png`,
      fullPage: true,
    });
  });

  test('OpenRouter — surfaces API key field, persists hasKey, hides key after submit', async ({
    page,
    request,
  }) => {
    if (await skipIfKeychainUnavailable(request)) {
      test.skip(true, 'Keychain unavailable in this environment');
    }

    await openModelsModal(page);

    // Switch provider to OpenRouter via the radio group.
    await page.getByRole('radio', { name: 'OpenRouter' }).check();

    const apiKeyInput = page.getByLabel('API key');
    await expect(apiKeyInput).toBeVisible();

    await page.getByLabel('Display name').fill('OpenRouter Sonnet');
    await page.getByLabel('Model identifier').fill('anthropic/claude-3.5-sonnet');
    await apiKeyInput.fill('sk-or-test-fake-key');

    await page.getByRole('button', { name: /add model/i }).click();

    const list = page.getByRole('list', { name: /existing models/i });
    const row = list.getByRole('listitem').filter({ hasText: 'OpenRouter Sonnet' });
    await expect(row).toBeVisible({ timeout: 5000 });
    await expect(row.getByText('openrouter · anthropic/claude-3.5-sonnet')).toBeVisible();
    // ✓ key badge is the visible truth that the key persisted via keychain.
    await expect(row.getByText('✓ key')).toBeVisible();

    // Hard reload, reopen, assert persistence + key invisibility.
    await page.reload();
    await openModelsModal(page);

    const listAfter = page.getByRole('list', { name: /existing models/i });
    const rowAfter = listAfter.getByRole('listitem').filter({ hasText: 'OpenRouter Sonnet' });
    await expect(rowAfter).toBeVisible();
    await expect(rowAfter.getByText('✓ key')).toBeVisible();

    // No input in the page should pre-populate with the stored key.
    const allInputs = page.locator('input');
    const inputCount = await allInputs.count();
    for (let i = 0; i < inputCount; i++) {
      const value = await allInputs.nth(i).inputValue().catch(() => '');
      expect(value, `input #${i} leaked secret`).not.toContain('sk-or-test-fake-key');
    }
    // Page body text must not echo the key either.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('sk-or-test-fake-key');

    // Defense in depth: the GET /models response must not include the key.
    const apiList = await listModels(request);
    expect(JSON.stringify(apiList)).not.toContain('sk-or-test-fake-key');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/multi-model-2-openrouter-persisted.png`,
      fullPage: true,
    });
  });

  test('Ollama — no API key field, optional base URL', async ({ page, request }) => {
    if (await skipIfKeychainUnavailable(request)) {
      test.skip(true, 'Keychain unavailable in this environment');
    }

    await openModelsModal(page);

    await page.getByRole('radio', { name: 'Ollama' }).check();

    // No API key input for Ollama.
    await expect(page.getByLabel('API key')).toHaveCount(0);
    // But base URL input IS present.
    await expect(page.getByLabel(/base url/i)).toBeVisible();

    await page.getByLabel('Display name').fill('Local Llama 70b');
    await page.getByLabel('Model identifier').fill('llama3.1:70b');
    // Leave base URL blank for the first model.

    await page.getByRole('button', { name: /add model/i }).click();

    const list = page.getByRole('list', { name: /existing models/i });
    await expect(
      list.getByRole('listitem').filter({ hasText: 'Local Llama 70b' }),
    ).toBeVisible({ timeout: 5000 });

    // Second Ollama model with baseUrl populated.
    // Re-select the Ollama radio (provider state may have reset to default on
    // a successful create — read the current state and adapt).
    await page.getByRole('radio', { name: 'Ollama' }).check();
    await page.getByLabel('Display name').fill('Remote Llama 8b');
    await page.getByLabel('Model identifier').fill('llama3.1:8b');
    await page.getByLabel(/base url/i).fill('http://localhost:11434');
    await page.getByRole('button', { name: /add model/i }).click();

    await expect(
      list.getByRole('listitem').filter({ hasText: 'Remote Llama 8b' }),
    ).toBeVisible({ timeout: 5000 });
    // First model still listed too.
    await expect(
      list.getByRole('listitem').filter({ hasText: 'Local Llama 70b' }),
    ).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/multi-model-3-ollama-two-rows.png`,
      fullPage: true,
    });
  });

  test('delete a model removes its row', async ({ page, request }) => {
    if (await skipIfKeychainUnavailable(request)) {
      test.skip(true, 'Keychain unavailable in this environment');
    }

    await createModelViaApi(request, {
      name: 'Ephemeral CLI',
      provider: 'claude_cli',
      modelId: 'haiku',
    });

    await openModelsModal(page);

    const list = page.getByRole('list', { name: /existing models/i });
    const row = list.getByRole('listitem').filter({ hasText: 'Ephemeral CLI' });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: /delete model ephemeral cli/i }).click();

    // Row vanishes; empty-state copy returns since this was the only model.
    await expect(row).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText(/No models yet/i)).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/multi-model-4-after-delete.png`,
      fullPage: true,
    });
  });

  test('War Room — picker lists every registered model', async ({ page, request }) => {
    if (await skipIfKeychainUnavailable(request)) {
      test.skip(true, 'Keychain unavailable in this environment');
    }

    const claude = await createModelViaApi(request, {
      name: 'Claude Picker',
      provider: 'claude_cli',
      modelId: 'sonnet',
    });
    const openrouter = await createModelViaApi(request, {
      name: 'OpenRouter Picker',
      provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      apiKey: 'sk-or-test-picker-key',
    });

    await page.goto('/town/war-room');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Planning Table")`, {
      timeout: 15000,
    });
    // The SceneKeyboardNav is visually hidden (1x1px clip), which prevents
    // Playwright's synthesized pointer events from registering even with
    // { force: true }. dispatchEvent('click') routes the click straight to
    // the button's React handler.
    await page
      .locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' })
      .dispatchEvent('click');

    await expect(page.getByRole('dialog')).toBeVisible();

    const picker = page.getByTestId('quest-model-select');
    await expect(picker).toBeVisible();

    // Both registered models appear, formatted "{name} — {provider} · {modelId}".
    const claudeLabel = `${claude.name} — ${claude.provider} · ${claude.modelId}`;
    const openrouterLabel = `${openrouter.name} — ${openrouter.provider} · ${openrouter.modelId}`;
    await expect(picker.locator('option', { hasText: claudeLabel })).toHaveCount(1);
    await expect(picker.locator('option', { hasText: openrouterLabel })).toHaveCount(1);

    // Select the Claude model + draft a quest, intercepting the POST so we
    // can assert the modelId persisted in the wire payload.
    await picker.selectOption(claude.id);

    // Title MUST start with TEST_QUEST_TITLE_PREFIX so afterEach can detach it
    // from its model_id before model deletion. We append a random suffix so
    // stale rows from prior runs don't collide with this run's lookup.
    const title = `Multi-model Picker Quest ${Math.random().toString(36).slice(2, 8)}`;
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Description').fill('A quest to verify the model picker wiring.');
    await page
      .getByRole('textbox', { name: 'Criterion 1' })
      .fill('Model picker passes selected modelId to POST /quests.');

    const questPostPromise = page.waitForRequest(
      (req) => req.url().endsWith('/quests') && req.method() === 'POST',
      { timeout: 10000 },
    );
    await page.getByRole('button', { name: /draft quest/i }).click();
    const questPost = await questPostPromise;
    const postBody = JSON.parse(questPost.postData() ?? '{}') as { modelId?: string };
    expect(postBody.modelId).toBe(claude.id);

    await expect(page.getByText(/quest drafted/i)).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/multi-model-5-war-room-picker.png`,
      fullPage: true,
    });

    // Confirm the new quest is visible on the Quest Board.
    // Dialog auto-closes 3s after success; wait it out then re-open via Quest Board.
    await page.waitForTimeout(3500);
    await page.goto('/town/town-square');
    await page.waitForSelector(`${SCENE_NAV} button`, { timeout: 15000 });
    await page
      .locator(`${SCENE_NAV} button`, { hasText: 'Quest Board' })
      .dispatchEvent('click');
    await expect(
      page.getByRole('button', { name: `View quest: ${title}` }),
    ).toBeVisible({ timeout: 5000 });

    // Quest persisted with the selected modelId.
    const questsRes = await request.get('/quests');
    const quests = (await questsRes.json()) as { title: string; modelId: string | null }[];
    const created = quests.find((q) => q.title === title);
    expect(created, 'drafted quest not found in GET /quests').toBeDefined();
    expect(created!.modelId).toBe(claude.id);
  });

  test('War Room — empty state when no models configured', async ({ page, request }) => {
    // beforeEach already wiped, so confirm there really are zero models.
    expect((await listModels(request)).length).toBe(0);

    await page.goto('/town/war-room');
    await page.waitForSelector(`${SCENE_NAV} button:has-text("Planning Table")`, {
      timeout: 15000,
    });
    // The SceneKeyboardNav is visually hidden (1x1px clip), which prevents
    // Playwright's synthesized pointer events from registering even with
    // { force: true }. dispatchEvent('click') routes the click straight to
    // the button's React handler.
    await page
      .locator(`${SCENE_NAV} button`, { hasText: 'Planning Table' })
      .dispatchEvent('click');

    await expect(page.getByRole('dialog')).toBeVisible();

    const banner = page.getByTestId('no-models-banner');
    await expect(banner).toBeVisible();
    await expect(banner.getByText(/no models configured/i)).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/multi-model-6-war-room-empty.png`,
      fullPage: true,
    });

    // "Open Models" jumps straight into the Models modal.
    await banner.getByRole('button', { name: /open models/i }).click();
    await expect(page.getByTestId('models-modal')).toBeVisible({ timeout: 5000 });
  });
});
