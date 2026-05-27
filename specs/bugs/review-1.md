# BUG: adventurers.class missing CHECK constraint — Zod enum has no DB counterpart
**Severity:** HIGH
**File(s):** packages/server/src/db/migrations/001_init.sql, packages/shared/src/adventurer.ts

## Problem
The `AdventurerClassSchema` (`packages/shared/src/adventurer.ts:3`) restricts class to 5 enum values:
`'champion' | 'ranger' | 'scout' | 'rogue' | 'apprentice'`.

The corresponding DB column has no CHECK constraint:

```sql
-- packages/server/src/db/migrations/001_init.sql:6
class TEXT NOT NULL,
```

This is a cross-boundary mismatch. The DB accepts any string for `class`, but the Zod schema rejects everything outside the 5-value enum. Tests in `packages/server/src/db/__tests__/connection.test.ts` insert classes `'wizard'` (line 90) and `'paladin'` (line 184) which the Zod schema would reject — the inserts succeed only because the DB has no constraint, masking the gap.

## Expected
Task ashford acceptance criterion: "AdventurerClass enum values match the DB CHECK constraint values exactly".

Per `rules/database-conventions.md` (Schema Enum Consistency): "Every database column with a constraint... must have ALL allowed values represented in: the corresponding frontend schema, the UI options, the backend enum." The inverse is also required — every enum at the application layer that restricts values must be enforced at the DB layer with a matching CHECK constraint.

Per `rules/review-contract.md` (Boundary Contract Validation): values crossing system boundaries must match the receiving system's constraints. The DB is the receiving system here and currently enforces nothing.

## Fix
1. Add a CHECK constraint to `adventurers.class` in `packages/server/src/db/migrations/001_init.sql`:

   ```sql
   class TEXT NOT NULL
     CHECK(class IN ('champion', 'ranger', 'scout', 'rogue', 'apprentice')),
   ```

2. Update `packages/server/src/db/__tests__/connection.test.ts` to use valid class values from the enum (e.g., replace `'wizard'` with `'apprentice'`, `'paladin'` with `'champion'`).

3. Add a regression test that inserting an invalid class (e.g., `'wizard'`) raises an error, mirroring the existing `rejects invalid quest status` test.
