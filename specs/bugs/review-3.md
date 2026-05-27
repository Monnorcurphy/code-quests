# BUG: FK and CHECK violations return opaque 500 instead of a field-named 400

**Severity:** LOW
**File(s):** `packages/server/src/routes/quests.ts`, `packages/server/src/routes/adventurers.ts`, `packages/server/src/middleware/errors.ts`

## Problem

`POST /quests` and `PATCH /quests/:id` accept `epicId` and `adventurerId` and pass them straight into the SQL. Same goes for `adventurer_id` references inside the schema.

If the caller sends `{"title":"x","epicId":"ghost"}`, better-sqlite3 throws `SQLITE_CONSTRAINT_FOREIGNKEY`. The route doesn't catch it, the Express error handler returns a generic `500 Internal server error`.

The rules require otherwise:

- `input-validation.md` rule 3: "Errors must name the field and the fix" — "Failed to save profile" is explicitly listed as wrong.
- `ux-design.md`: speak human, not developer; never leave the user with "ECONNREFUSED" or "SQLITE_CONSTRAINT" symptoms.
- Acceptance criteria for this task: "Body validation rejects malformed input with field-named errors" and "Error responses are JSON with `{ error: string, field?: string }` shape" — 500 is neither.

A non-existent referenced entity is a 404 (or 400 with `field`); a CHECK violation is a 400.

There are no tests covering this case (POST/PATCH a quest with an unknown `epicId` / `adventurerId`). The mocked or in-memory boundary in the current test suite never exercises the FK path through the API.

## Expected

- `POST /quests` and `PATCH /quests/:id` with an unknown `epicId` → `400 { error: "...", field: "epicId" }` (or `404`).
- Same for `adventurerId`.
- Tests cover both cases.
- Pre-validate at the API layer (cheaper, gives a better message) rather than rely on the DB exception.

## Fix

Add a helper in the quests router:

```ts
function assertReferenceExists(db: Database.Database, table: 'epics' | 'adventurers', id: string | null | undefined, field: string, res: Response): boolean {
  if (id == null) return true;
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!row) {
    res.status(400).json({ error: `${field} does not reference an existing ${table.slice(0, -1)}`, field });
    return false;
  }
  return true;
}
```

Invoke it for `epicId` / `adventurerId` in POST and PATCH before the INSERT/UPDATE. Add integration tests:

```ts
it('rejects POST /quests with an unknown epicId', async () => { ... expect(res.status).toBe(400); expect(res.body.field).toBe('epicId'); });
it('rejects PATCH /quests/:id with an unknown adventurerId', async () => { ... });
```

Alternative: keep the DB as the source of truth but catch the SQLite error in the errorHandler and translate `SQLITE_CONSTRAINT_*` codes into a 400 with the offending column. Either approach satisfies the rules.
