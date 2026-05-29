# BUG: slugify can return empty string, producing collisions across distinct names

**Severity:** LOW
**File(s):** packages/server/src/routes/monsters.ts

## Problem

`slugify()` in `packages/server/src/routes/monsters.ts` strips every character that is not `[a-z0-9\s-]`. For names made entirely of non-ASCII characters or symbols, this returns an empty string. The route then constructs the id `'user:' + ''` → `'user:'`.

Two consequences:

1. The first POST with name `'***'` succeeds with id `'user:'`.
2. A subsequent POST with a *different* name like `'@@@'` (or `'日本語'`, `'###'`, etc.) also slugifies to `''`, computes the same id `'user:'`, and is rejected with `409 'A monster type with this name already exists'`. The message lies — the *name* is not the same; the slug is.

Reproduction (verified directly against `slugify`):

```
'!@#$'    -> ''
'***'     -> ''
'日本語'   -> ''
```

A user who picks a non-Latin-script name (or any symbol-heavy name) is told the name is taken by an earlier type they never created.

## Expected

The route should never construct an id with an empty slug suffix. Per the spec, the id is `'user:' + slug(name)` where slug is "kebab-case, ASCII-only" — i.e., it must contain at least one ASCII alphanumeric character. An input that has no ASCII alphanumerics must be rejected at the schema/route boundary with a 400 that names the field (`name`) and explains the constraint (e.g., "Name must include at least one ASCII letter or digit").

This matches the cross-cutting input-validation rule (`rules/input-validation.md`): constrain inputs so invalid states are impossible — don't accept input that the slug pipeline cannot turn into a valid id.

## Fix

Reject empty slugs early. Two options; either is acceptable:

Option A — validate after slugify in `packages/server/src/routes/monsters.ts`:

```ts
const slug = slugify(name);
if (!slug) {
  res.status(400).json({
    error: 'Name must include at least one ASCII letter or digit',
    field: 'name',
  });
  return;
}
const id = `user:${slug}`;
```

Option B — tighten `CreateMonsterTypeSchema` in `packages/shared/src/monster-type-actions.ts` to require at least one ASCII alphanumeric:

```ts
name: z.string().trim().min(1).max(60).regex(/[A-Za-z0-9]/, {
  message: 'Name must include at least one ASCII letter or digit',
}),
```

Add a test to `packages/server/src/routes/__tests__/monsters-types.test.ts`:

```ts
it('returns 400 when name has no ASCII alphanumerics', async () => {
  const res = await request(app).post('/monsters/types').send({
    ...validBody,
    name: '***',
  });
  expect(res.status).toBe(400);
});
```
