# Progress — Phase 1

Previous task progress archived to metrics/progress-before-arundel.md

## arundel — SQLite schema + migrations

**Status:** complete

**What was done:**
- Created root monorepo files (package.json, pnpm-workspace.yaml, tsconfig.base.json, .eslintrc.cjs, .npmrc) — prerequisite infrastructure from alhambra branch that wasn't yet merged
- Added `better-sqlite3` and `@types/better-sqlite3` to server package; configured `pnpm.onlyBuiltDependencies` to allow native build
- `packages/server/src/db/connection.ts` — opens DB at `~/.code-quests/db.sqlite`, ensures dir, sets `PRAGMA foreign_keys = ON` and `journal_mode = WAL`
- `packages/server/src/db/migrations/001_init.sql` — full schema: 3 Phase 1 tables (adventurers, epics, quests) + 7 reserved tables (agents, monster_types, monsters, monster_encounters, skills, tools, mcp_servers)
- `packages/server/src/db/migrator.ts` — forward-only migrator with schema_migrations tracking table; idempotent
- `packages/server/src/db/__tests__/connection.test.ts` — 16 tests covering: FK pragma ON, FK violation throws, migrator idempotency, all 11 tables exist, full CRUD for adventurers/epics/quests, status CHECK constraint, nullable FK

**Test results:** 22 tests pass (18 server, 2 shared, 2 client); typecheck clean; lint clean
