# BUG: Reduced-motion tests leave `window.matchMedia` set to undefined

**Severity:** LOW
**File(s):** `packages/client/src/game/scenes/__tests__/quest-scenes.test.ts`

## Problem

The two `reduced-motion:` test cases in `quest-scenes.test.ts:414-443` install a `matchMedia` mock at the start and then "restore" it by setting it back to `undefined`:

```typescript
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: undefined,
});
```

Two issues:
1. This is not a restore — it overwrites whatever `matchMedia` JSDOM (or a prior test) installed. Subsequent test files that depend on `window.matchMedia` being callable will get `TypeError: window.matchMedia is not a function` if not for the optional-chain in `base-quest-scene.ts:60` / `player.ts:46`. The codebase happens to guard with `?.`, so it survives — but this is brittle. A future caller that does `window.matchMedia('...')` (no optional chain) will start failing in tests run after this file.
2. Vitest runs each file in an isolated environment by default, so cross-file leak is unlikely with the default `isolate: true`. But cross-test (within the same file) leak still happens: any later test in this file that relies on `matchMedia` will get `undefined`. Right now no later test does, but it's an unsafe pattern.

## Expected

Tests should snapshot and restore the original `matchMedia`, or use vitest's stub APIs (`vi.stubGlobal('matchMedia', ...)` + `vi.unstubAllGlobals()` in `afterEach`).

## Fix

Use `vi.stubGlobal` and `vi.unstubAllGlobals`:

```typescript
afterEach(() => {
  vi.unstubAllGlobals();
  (scene as any)._unsubscribeStore?.();
});

it('reduced-motion: sets canvas opacity to 0.7 on freeze instead of overlay', () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
  scene.create();
  useQuestStore.getState().setStatus('q1', 'paused_input');
  expect(canvasStyle.opacity).toBe('0.7');
  expect(scene._dimOverlay).toBeNull();
});
```

This avoids the manual `Object.defineProperty` snapshot/restore dance and is symmetric with how other tests in the project mock globals.
