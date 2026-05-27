# BUG: "update skips game logic when activeModal is set" test asserts on the wrong mock

**Severity:** LOW
**File(s):** `packages/client/src/game/scenes/__tests__/town-square-scene.test.ts`

## Problem

The test at `town-square-scene.test.ts:235-244`:

```ts
it('update skips game logic when activeModal is set', () => {
  scene.create();
  vi.mocked(useTownStore.getState as MockStoreFn).mockReturnValue(
    buildMockStore({ activeModal: 'quest-board' }),
  );

  scene.update(0, 16);

  expect(mockStore.setPlayerX).not.toHaveBeenCalled();
});
```

`buildMockStore({ activeModal: 'quest-board' })` constructs a NEW mock store with its OWN `setPlayerX: vi.fn()`. `useTownStore.getState` is reconfigured to return that NEW store. But the assertion checks `mockStore.setPlayerX` — the ORIGINAL store from `beforeEach`, which is no longer what the scene uses.

Because of this, the assertion passes whether or not `super.update()` actually ran:
- If `super.update()` ran, it would call `setPlayerX` on the NEW store, not the original one. The assertion on the original `mockStore.setPlayerX` is still `not.toHaveBeenCalled()`.
- If `super.update()` was skipped, no `setPlayerX` is called anywhere. Same result.

The test cannot detect a regression where the early-return guard is removed and `super.update()` always runs.

## Expected

Tests must actually verify the behavior they describe (`.claude/rules/testing.md`: "no flaky tests, no skipped assertions"). The assertion should check the mock that `scene.update()` is actually using.

## Fix

Assert on the new mock store, or restructure so both `getState()` calls return the same mock with the modified `activeModal`. For example:

```ts
it('update skips game logic when activeModal is set', () => {
  scene.create();

  const pausedStore = buildMockStore({ activeModal: 'quest-board' });
  vi.mocked(useTownStore.getState as MockStoreFn).mockReturnValue(pausedStore);

  scene.update(0, 16);

  expect(pausedStore.setPlayerX).not.toHaveBeenCalled();
  expect(pausedStore.setFacing).not.toHaveBeenCalled();
});
```

Optionally add the inverse test (assert `setPlayerX` IS called when `activeModal` is null) to lock the guard down.
