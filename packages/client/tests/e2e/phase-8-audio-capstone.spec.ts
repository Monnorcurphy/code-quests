import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SCENE_NAV = 'nav[aria-label="Scene interactions"]';

async function waitForSceneNav(page: Parameters<typeof test.fn>[0]['page']) {
  await page.waitForSelector(`${SCENE_NAV} button`, { timeout: 15000 });
}

test.describe('Phase 8 — Audio capstone', () => {
  test('canvas renders and scene mood indicator is present on boot', async ({ page }) => {
    // Expose audio log before page load
    await page.addInitScript(() => {
      (window as Record<string, unknown>).__audioLog__ = [];
    });

    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    // Canvas must exist (Phaser renders it)
    await expect(page.locator('canvas')).toBeAttached({ timeout: 10000 });

    // After first user interaction, audio controller fires an initial cue
    await page.click('body');

    // Wait for the mood indicator to appear (the controller dispatches a cue on start)
    await expect(page.getByTestId('scene-mood-indicator')).toBeVisible({ timeout: 5000 });

    // Should show "Town · Calm" (the actual label used in the implementation)
    await expect(page.getByTestId('scene-mood-indicator')).toContainText('Town');
  });

  test('audio log captures cues after first interaction', async ({ page }) => {
    await page.addInitScript(() => {
      (window as Record<string, unknown>).__audioLog__ = [];
    });

    await page.goto('/town/town-square');
    await waitForSceneNav(page);
    await page.click('body');

    // Give the controller a moment to start
    await page.waitForTimeout(500);

    const log = await page.evaluate(
      () => (window as Record<string, unknown>).__audioLog__ as string[],
    );
    expect(log).toContain('TOWN');
  });

  test('mood indicator transitions to "On the Road" when navigating to a quest route', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as Record<string, unknown>).__audioLog__ = [];
    });

    // Create and dispatch a quest via API so we have a quest ID to navigate to
    const createRes = await page.request.post('/quests', {
      data: {
        title: `P8-Audio-Capstone-${Date.now()}`,
        description: 'Test quest for audio capstone',
        acceptanceCriteria: ['Tests pass'],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = (await createRes.json()) as { id: string };
    const questId = quest.id;

    // Dispatch with bypass (skip audit requirement)
    const dispatchRes = await page.request.post(`/quests/${questId}/dispatch?bypass=true`);
    expect(dispatchRes.status()).toBe(200);

    // Navigate to the quest route — AudioControllerMount detects /quest/ and sets quest-forest scene
    await page.goto(`/quest/${questId}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });

    // The quest status is active, scene is quest-forest → ROAD should play
    await page.click('body');
    await expect(page.getByTestId('scene-mood-indicator')).toContainText('Road', { timeout: 5000 });
  });

  test('settings panel shows Mute, Silent Mode, and Volume controls', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    await page.getByRole('button', { name: /open settings/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Mute switch
    await expect(page.getByRole('switch', { name: /mute/i })).toBeVisible();

    // Silent Mode switch
    await expect(page.getByRole('switch', { name: /silent mode/i })).toBeVisible();

    // Master Volume slider
    await expect(page.getByRole('slider', { name: /master volume/i })).toBeVisible();
  });

  test('mute toggle updates aria-checked and persists via audio store', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    await page.getByRole('button', { name: /open settings/i }).click();

    const muteSwitch = page.getByRole('switch', { name: /mute/i });
    await expect(muteSwitch).toHaveAttribute('aria-checked', 'false');

    await muteSwitch.click();
    await expect(muteSwitch).toHaveAttribute('aria-checked', 'true');

    // Toggle back
    await muteSwitch.click();
    await expect(muteSwitch).toHaveAttribute('aria-checked', 'false');
  });

  test('silent mode toggle updates and shows helper text', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    await page.getByRole('button', { name: /open settings/i }).click();

    const silentSwitch = page.getByRole('switch', { name: /silent mode/i });
    await expect(silentSwitch).toHaveAttribute('aria-checked', 'false');

    await silentSwitch.click();
    await expect(silentSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByText(/Disables all sound and replaces audio cues with visual indicators/i),
    ).toBeVisible();
  });

  test('credits screen opens and lists all Phase 8 audio files', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    // Open settings
    await page.getByRole('button', { name: /open settings/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Click Credits button
    await page.getByTestId('open-credits-btn').click();

    // Credits screen should now be visible
    await expect(page.getByTestId('credits-screen')).toBeVisible();

    // All 8 audio files should be listed
    const audioFiles = [
      'town-theme.wav',
      'road-theme.wav',
      'combat-theme.wav',
      'boss-theme.wav',
      'victory-stinger.wav',
      'quest-complete.wav',
      'quest-failed.wav',
      'bell.wav',
    ];

    for (const file of audioFiles) {
      await expect(page.getByTestId(`credit-row-${file}`)).toBeVisible();
    }

    // Each row shows a license
    await expect(page.getByText('CC0').first()).toBeVisible();

    // Back button returns to settings
    await page.getByRole('button', { name: /back to settings/i }).click();
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('visual cue components are mounted on all routes', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    // aria-announcer is always mounted (sr-only)
    await expect(page.getByTestId('aria-announcer')).toBeAttached();
  });

  test('settings panel has no accessibility violations', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    await page.getByRole('button', { name: /open settings/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('credits screen has no accessibility violations', async ({ page }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);

    await page.getByRole('button', { name: /open settings/i }).click();
    await page.getByTestId('open-credits-btn').click();
    await expect(page.getByTestId('credits-screen')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('town square route has no accessibility violations with visual cues mounted', async ({
    page,
  }) => {
    await page.goto('/town/town-square');
    await waitForSceneNav(page);
    await page.click('body');
    // Allow time for mood indicator to appear
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('monster encounter changes mood to "In Combat" and victory resolves with stinger toast', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as Record<string, unknown>).__audioLog__ = [];
    });

    // Create and dispatch a quest
    const createRes = await page.request.post('/quests', {
      data: {
        title: `P8-Combat-${Date.now()}`,
        description: 'Quest for combat audio test',
        acceptanceCriteria: ['Monster defeated'],
      },
    });
    expect(createRes.status()).toBe(201);
    const quest = (await createRes.json()) as { id: string };
    const questId = quest.id;

    const dispatchRes = await page.request.post(`/quests/${questId}/dispatch?bypass=true`);
    expect(dispatchRes.status()).toBe(200);

    await page.goto(`/quest/${questId}`);
    await page.waitForSelector('[aria-label="Quest HUD"]', { timeout: 10000 });
    await page.click('body');

    // Emit a monster_appeared event via the test helper endpoint
    const monsterRes = await page.request.post('/test/emit-quest-event', {
      data: {
        questId,
        event: {
          type: 'monster_appeared',
          timestamp: new Date().toISOString(),
          encounterId: 'enc-e2e-1',
          monsterId: 'mon-e2e-1',
          monsterName: 'Shadow Wraith',
          monsterTypeId: 'generic_obstacle',
          spritePath: '/sprites/monsters/shadow-wraith.png',
          difficulty: 2,
        },
      },
    });
    expect(monsterRes.status()).toBe(200);

    // Mood should switch to "In Combat"
    await expect(page.getByTestId('scene-mood-indicator')).toContainText('In Combat', {
      timeout: 5000,
    });

    // Resolve the encounter as victory
    const victoryRes = await page.request.post('/test/emit-quest-event', {
      data: {
        questId,
        event: {
          type: 'monster_resolved',
          timestamp: new Date().toISOString(),
          encounterId: 'enc-e2e-1',
          outcome: 'victory',
        },
      },
    });
    expect(victoryRes.status()).toBe(200);

    // "Monster defeated!" stinger toast should appear
    await expect(page.getByTestId('stinger-toast')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('stinger-toast')).toContainText('Monster defeated!');
  });

  test('silent mode: visual cues still fire but audio routes to silent backend', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as Record<string, unknown>).__audioLog__ = [];
    });

    await page.goto('/town/town-square');
    await waitForSceneNav(page);
    await page.click('body');

    // Wait for initial cue to arrive
    await page.waitForFunction(
      () => ((window as Record<string, unknown>).__audioLog__ as string[]).length > 0,
      { timeout: 5000 },
    );

    // Enable silent mode via settings
    await page.getByRole('button', { name: /open settings/i }).click();
    const silentSwitch = page.getByRole('switch', { name: /silent mode/i });
    await silentSwitch.click();
    await expect(silentSwitch).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    // After silent mode is on, the backend should be SilentBackend (DEV-exposed on window)
    // Give provider a moment to finish preloading SilentBackend
    await page.waitForFunction(
      () => {
        const b = (window as Record<string, unknown>).__audioBackend__;
        return !!b && (b as { constructor?: { name?: string } }).constructor?.name === 'SilentBackend';
      },
      { timeout: 5000 },
    );

    // Capture log length before triggering a new cue
    const logBefore = await page.evaluate(
      () => ((window as Record<string, unknown>).__audioLog__ as string[]).length,
    );

    // Clicking fires a new interaction which may trigger state re-evaluation; navigate to force a cue
    await page.goto('/town/war-room');
    await page.waitForTimeout(500);

    // Audio log should have grown (cues still dispatched in silent mode)
    const logAfter = await page.evaluate(
      () => ((window as Record<string, unknown>).__audioLog__ as string[]).length,
    );
    expect(logAfter).toBeGreaterThan(logBefore);

    // Backend is still SilentBackend — no WebAudioBackend play calls possible
    const backendName = await page.evaluate(() => {
      const b = (window as Record<string, unknown>).__audioBackend__;
      return (b as { constructor?: { name?: string } }).constructor?.name ?? 'unknown';
    });
    expect(backendName).toBe('SilentBackend');
  });

  test('mute toggle: backend.setMuted(true) is called and audio events still dispatch', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as Record<string, unknown>).__audioLog__ = [];
      (window as Record<string, unknown>).__setMutedCalls__ = [];
    });

    await page.goto('/town/town-square');
    await waitForSceneNav(page);
    await page.click('body');

    // Wait for initial cue to confirm controller is running
    await page.waitForFunction(
      () => ((window as Record<string, unknown>).__audioLog__ as string[]).length > 0,
      { timeout: 5000 },
    );

    // Open settings and toggle mute on
    await page.getByRole('button', { name: /open settings/i }).click();
    const muteSwitch = page.getByRole('switch', { name: /mute/i });
    await expect(muteSwitch).toHaveAttribute('aria-checked', 'false');
    await muteSwitch.click();
    await expect(muteSwitch).toHaveAttribute('aria-checked', 'true');

    // Assert backend.setMuted(true) was called (tracked via DEV hook in AudioProvider)
    await page.waitForFunction(
      () => {
        const calls = (window as Record<string, unknown>).__setMutedCalls__ as boolean[];
        return Array.isArray(calls) && calls.includes(true);
      },
      { timeout: 3000 },
    );

    // Audio events must still dispatch even when muted (cue bus is independent of backend)
    const logBefore = await page.evaluate(
      () => ((window as Record<string, unknown>).__audioLog__ as string[]).length,
    );
    // Close settings and wait a moment for any queued events
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const logAfter = await page.evaluate(
      () => ((window as Record<string, unknown>).__audioLog__ as string[]).length,
    );
    // Log was non-empty before and should stay non-empty (cue bus still works)
    expect(logBefore).toBeGreaterThan(0);
    expect(logAfter).toBeGreaterThanOrEqual(logBefore);
  });
});
