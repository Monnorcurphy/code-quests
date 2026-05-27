# BUG: `SceneKey` type cast in test-scene bypasses TypeScript safety

**Severity:** LOW
**File(s):** packages/client/src/game/scenes/test-scene.ts, packages/client/src/game/scene-registry.ts

## Problem

`packages/client/src/game/scene-registry.ts` defines:

```ts
export type SceneKey = 'boot';
```

`packages/client/src/game/scenes/test-scene.ts:54` registers a new scene with a literal that is NOT part of that union, using a type assertion to silence the compiler:

```ts
registerScene('test-scene' as SceneKey, TestScene);
```

This cast tells TypeScript a lie. The string `'test-scene'` is not a member of the `SceneKey` union, so any downstream code reading `currentScene` from the store and switching on it cannot safely include a `'test-scene'` case without similar casts. The TypeScript template rule in `.claude/rules/typescript.md` says *"Never use `any` — use `unknown` and narrow, or define a proper type"*; casting `string as Type` is the same class of escape hatch.

The fact that the registration is gated behind `import.meta.env.DEV` does not change the type story — the cast is present in the source either way.

## Expected

`SceneKey` should be widened to include every scene key that gets registered, OR `registerScene`/`getScene` should accept a wider type (e.g., `string`) with `SceneKey` reserved for production-only keys. Either way, no source file should need a synthetic cast to register a scene.

## Fix

Pick one:

1. Widen the union:
   ```ts
   export type SceneKey = 'boot' | 'test-scene';
   ```
   (Acceptable because `test-scene.ts` already guards itself with `import.meta.env.DEV`.)

2. Or relax `registerScene` to accept a broader key type while keeping `SceneKey` as the production union:
   ```ts
   export function registerScene(key: SceneKey | string, SceneClass: SceneConstructor): void { ... }
   ```

3. Then remove the `as SceneKey` cast from `test-scene.ts:54`.
