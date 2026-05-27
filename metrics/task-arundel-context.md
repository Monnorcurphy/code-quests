### TASK arundel: SQLite schema + migrations

**Goal:** Create the SQLite schema for Phase 1 entities, plus stubbed-but-reserved tables for the entities that arrive in later phases (so we don't have to drop the DB later).

**Files to create/modify:**
- `packages/server/src/db/connection.ts` — better-sqlite3 connection helper; opens DB at `~/.code-quests/db.sqlite`; ensures dir; sets `PRAGMA foreign_keys = ON`
- `packages/server/src/db/migrations/001_init.sql` — full schema
- `packages/server/src/db/migrator.ts` — minimal forward-only migrator that runs `.sql` files in order
- `packages/server/src/db/__tests__/connection.test.ts` — verifies FK pragma is ON; insert/read/update/delete for each Phase 1 table

**Phase 1 tables (must be implemented):**
- `adventurers` — id, name, class, model_id, created_at, stats_json, specializations_json, scars_json
- `epics` — id, title, goal, created_at
- `quests` — id, epic_id (FK nullable), title, description, acceptance_criteria_json, edge_cases_json, context, status, adventurer_id (FK nullable), agent_id nullable, equipment_json, spec_audit_json, created_at, updated_at, ac_locked_at, input_request_json nullable, user_blocker_json nullable, failure_summary_json nullable, user_feedback_json

**Reserved tables (create schema, no API yet):**
- `agents` — id, adventurer_id (FK), quest_id (FK), started_at, ended_at, pid, exit_code
- `monster_types` — id, name, sprite_path, default_difficulty, failure_signature, created_by
- `monsters` — id, type_id (FK), name, scope ('project'|'guild'), project_id nullable, first_seen_at, last_seen_at, encounters, defeats, escapes, calibrated_difficulty, notes
- `monster_encounters` — id, monster_id (FK), quest_id (FK), appeared_at, combat_log_json, outcome, loot_json
- `skills` — id, name, monster_type_ids_json, status, created_by, created_at, hit_count, implementation
- `tools` — id, name, description, invocation
- `mcp_servers` — id, name, config_json

**Acceptance criteria:**
- Migrator runs idempotently
- `PRAGMA foreign_keys = ON` enforced in both production and test DB init
- All Phase 1 tables have full CRUD tests
- Reserved tables exist after migration (verified by a `sqlite_master` query in a test)
- A FK violation throws (proves pragma is live)

---

