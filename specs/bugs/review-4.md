# BUG: E2E walkthrough does not assert HUD reflects the scene_change event

**Severity:** LOW
**File(s):** packages/client/tests/e2e/phase-5-capstone.spec.ts

## Problem

The task spec acceptance step 6 (`metrics/task-greatsword-context.md`) states:

> 6. Simulate a server event via a test-only debug endpoint (`POST /test/emit-quest-event` ...) that emits `scene_change` to boss-room → **assert HUD reflects it**

The test only checks that the emit POST returns 200, then waits 500ms before clicking Return to Town:

```ts
expect(emitRes.status()).toBe(200);

// Wait briefly for WebSocket event propagation
await page.waitForTimeout(500);

// 7. Click Return to Town
```

There is no assertion that the HUD actually advanced to `quest-boss-room` (e.g., the boss-room background visible, the quest status badge updated, or the store's scene reflecting boss-room). The test passes whether or not the WebSocket event was applied to the UI.

This violates the test-quality rule in `.claude/rules/testing.md`:
> Never wrap assertions in conditional checks ... assertions must be unconditional.

By analogy, the equivalent failure here is "no assertion at all where one is required."

## Expected

The test must positively confirm the HUD updated after the emit — e.g., wait for and assert visibility of an element / badge tied to `quest-boss-room`, or read the quest store to confirm `currentScene === 'quest-boss-room'`.

## Fix

After the 500ms wait (or replacing it with an assertion-based wait), add an assertion. For example, if the HUD shows current scene name via the quest GET refetch:

```ts
await expect(async () => {
  const fresh = await page.request.get(`/quests/${questId}`);
  const body = await fresh.json();
  expect(body.currentScene).toBe('quest-boss-room');
}).toPass({ timeout: 5000 });
```

or, if the Phaser background or HUD label reflects the scene, assert against the rendered DOM directly using a stable test id. Remove the bare `waitForTimeout(500)` in favor of an explicit wait/assert.
