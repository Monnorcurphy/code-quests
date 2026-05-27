# BUG: `isTownSceneKey` type predicate is too broad (returns `key is SceneKey`)

**Severity:** LOW
**File(s):** `packages/client/src/game/scene-registry.ts`, `packages/client/src/routes/town.tsx`

## Problem

`isTownSceneKey` only checks the `TOWN_SCENE_KEYS` array (8 town scenes) but declares its return type as `key is SceneKey`, which also includes `'boot'` and `'test-scene'`:

```ts
// scene-registry.ts
export function isTownSceneKey(key: string): key is SceneKey {
  return (TOWN_SCENE_KEYS as readonly string[]).includes(key);
}
```

This is semantically wrong: a `true` return narrows the parameter to the full `SceneKey` union when it should narrow to the town subset only. Consequences:

- In `routes/town.tsx` the cast `(rawSceneKey as SceneKey)` is needed even after the guard — a clue that the narrowing isn't doing its job.
- A future caller could be lulled into believing `isTownSceneKey(x) === true` implies `x === 'boot'` is possible — it never is.

## Expected

The predicate should narrow to exactly the keys it validates. Per `typescript.md`: "Never use `any` — use `unknown` and narrow, or define a proper type" — the same accuracy principle applies to type guards. A type guard must be true iff the parameter has the asserted type.

## Fix

Introduce a `TownSceneKey` type derived from `TOWN_SCENE_KEYS` and use it in the predicate:

```ts
export const TOWN_SCENE_KEYS = [
  'town-square',
  'war-room',
  'oracle',
  'library',
  'tavern',
  'armory',
  'guild-hall',
  'hall-of-returns',
] as const;

export type TownSceneKey = (typeof TOWN_SCENE_KEYS)[number];

export function isTownSceneKey(key: string): key is TownSceneKey {
  return (TOWN_SCENE_KEYS as readonly string[]).includes(key);
}
```

In `routes/town.tsx`, the `as SceneKey` cast can then be removed; `validSceneKey` becomes `TownSceneKey | 'boot'` (still assignable to `SceneKey`).
