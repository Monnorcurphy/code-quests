# BUG: idempotency test does not actually verify INSERT OR IGNORE
**Severity:** LOW
**File(s):** packages/server/src/db/__tests__/seed-monster-types.test.ts

## Problem
The test labelled `"is idempotent — running migrations twice yields exactly 10 rows"` calls `runMigrations(db)` a second time. However, `runMigrations()` in `packages/server/src/db/migrator.ts` records each applied migration in the `schema_migrations` table and short-circuits any file whose version is already present. On the second invocation, `006_monster_types_seed.sql` is in `applied` and the SQL is never re-executed. The test therefore passes regardless of whether the migration uses `INSERT OR IGNORE` or a plain `INSERT` — a future regression that drops `OR IGNORE` would not be caught.

## Expected
The acceptance criteria require that running the migration twice yields the same 10 rows. The test must exercise the SQL itself, not just the migration runner's de-dup logic.

## Fix
Re-run the seed SQL directly so the `INSERT OR IGNORE` behavior is actually exercised. For example, after the initial `makeDb()`:

```ts
import fs from 'fs';
import path from 'path';

it('is idempotent — re-running the seed SQL does not duplicate rows', () => {
  const seedSql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '006_monster_types_seed.sql'),
    'utf8',
  );
  db.exec(seedSql);            // run a second time, bypassing schema_migrations
  db.exec(seedSql);            // and a third for good measure
  const count = (
    db.prepare('SELECT COUNT(*) as n FROM monster_types').get() as { n: number }
  ).n;
  expect(count).toBe(10);
});
```

Alternatively, delete the row from `schema_migrations` and call `runMigrations(db)` again so the migrator re-executes the file.
