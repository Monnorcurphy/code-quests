# Database Conventions

Rules for database usage, schema design, and data persistence patterns.

## Foreign Key Enforcement (CRITICAL — SQLite)

SQLite disables FK constraints by default. Every connection must enable them.

Both production and test database initialization must execute `PRAGMA foreign_keys = ON;` immediately after opening the connection and BEFORE running migrations.

**Test requirement:** A unit test must verify that inserting a row with a non-existent FK reference raises an error (not silently succeeds).

## Save Operations Must UPSERT

All "save" or "update" operations for user-modifiable entities must use `INSERT OR REPLACE` (SQLite), `ON CONFLICT ... DO UPDATE` (Postgres), or explicit UPDATE-then-INSERT logic.

Never use bare `INSERT` for data the user can re-submit — it fails silently on second save.

**Test requirement:** Save the same entity twice with different values. Verify the second write succeeds and reflects the updated data.

## Schema Enum Consistency

Every database column with a constraint (e.g., `CHECK(column IN (...))`) must have ALL allowed values represented in:
1. The corresponding frontend schema (Zod, TypeScript enum, etc.)
2. The UI radio/select/dropdown options
3. The backend enum (if one exists)

**Test requirement:** For each constrained column, verify that the frontend schema's accepted values match the DB constraint values exactly.

## Migration Conventions

- Use versioned, append-only migrations (never edit a shipped migration)
- Name format: `V{N}__{description}.sql` (refinery) or equivalent for your migration tool
- Every migration must be reversible or have a documented rollback plan

## NULL Handling

- Required user fields: `NOT NULL` with a sensible DEFAULT or no default (force the caller to provide)
- Optional user fields: nullable, backend type is `Option<T>` / `Optional[T]` / `*T`
- Timestamps: `NOT NULL DEFAULT (datetime('now'))` or equivalent
- Boolean flags: `NOT NULL DEFAULT 0` (SQLite uses INTEGER 0/1)
