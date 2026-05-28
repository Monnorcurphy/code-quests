# BUG: Client `monsters.list` accepts untyped `scope: string` instead of `MonsterScope`
**Severity:** LOW
**File(s):** packages/client/src/lib/api.ts

## Problem
The client wrapper signature is:

```ts
list: (opts?: { scope?: string; typeId?: string }): Promise<Monster[]> => { ... }
```

`scope` is typed as a free-form `string`, even though the server only accepts the two
values constrained by `MonsterScopeSchema = z.enum(['project', 'guild'])`. A caller can
write `api.monsters.list({ scope: 'guilds' })` with no compile-time error; the call
silently round-trips and produces a 400 only at runtime.

The shared `MonsterScope` type was already imported in this file but is not used for
this parameter. The other shared types from this task (`Monster`, `MonsterEncounter`,
`MonsterType`) are used as return types — `MonsterScope` is the missing input type.

## Expected
Per `rules/cross-boundary.md` and `rules/typescript.md`: when a single shared schema
defines the allowed values, the client wrapper must use the inferred type so the
compiler enforces the constraint that the server enforces at the boundary. The whole
point of exporting `MonsterScope` from `@code-quests/shared` is so client callers
cannot construct invalid requests.

## Fix
1. Add `MonsterScope` to the type import in `packages/client/src/lib/api.ts`:

   ```ts
   import type { ..., MonsterType, Monster, MonsterEncounter, MonsterScope } from '@code-quests/shared';
   ```

2. Change the `list` signature from `scope?: string` to `scope?: MonsterScope`:

   ```ts
   list: (opts?: { scope?: MonsterScope; typeId?: string }): Promise<Monster[]> => { ... }
   ```

(`typeId` correctly stays `string` — it is an open-ended identifier, not an enum.)
