# Review Pass — TASK citrine: Skills / Tools / MCP servers read API + seed catalog

**Verdict:** PASS (0 bugs filed)

## Checks Performed

- Read pre-computed diff covering 9 files (160 LOC test, 21 LOC seed migration, 3 small routers, schema additions, index mounting, progress note).
- Read full source for: `equipment.ts`, `index.ts`, `routes/skills.ts`, `routes/tools.ts`, `routes/mcp-servers.ts`, `db/migrator.ts`, `db/connection.ts`, `db/migrations/001_init.sql`, `db/migrations/002_seed_equipment.sql`, `__tests__/equipment-catalog.test.ts`.
- Compared against task spec at `metrics/task-citrine-context.md`.
- Cross-boundary verification: SQL CHECK constraints vs Zod enums vs seed values.
- Ran full test suite: `pnpm test` — 101 server, 58 shared, 206 client tests all pass.
- Ran `pnpm typecheck` — clean.
- Ran `pnpm lint` — clean.
- Secret scan (`sk-`, `AKIA`, `api_key=`, `password=`) — no real matches (only false positive on the word "disk").
- Capstone: citrine is NOT the phase capstone (garnet is, per `specs/phase-03/sequence.md`). Capstone coverage rule does not apply.
- FK pragma: confirmed in `db/connection.ts` (`db.pragma('foreign_keys = ON')`).
- Phase 1 reserved tables (`skills`, `tools`, `mcp_servers`) reused; no schema-altering migration added for citrine (matches the read-only Phase 3 scope).

## Acceptance Criteria — Status

| Criterion | Result |
|---|---|
| `GET /skills`, `/tools`, `/mcp-servers` each return seed rows | PASS |
| Every returned row parses through shared schema (via `parse`, not `safeParse`) | PASS |
| Migration `002_seed_equipment.sql` is idempotent — no error, no dup rows | PASS (see note 1) |
| Phase 1 + new Phase 3 tests green | PASS |

## INFORMATIONAL Notes

1. **Idempotency test exercises the migrator's bookkeeping, not the raw `INSERT OR IGNORE`.**
   The test calls `runMigrations(db)` a second time, which short-circuits via `schema_migrations` and never re-executes `002_seed_equipment.sql`. The acceptance criterion ("running migrations twice does not error and does not duplicate rows") is literally satisfied, but the deeper property — that the seed SQL itself is idempotent if re-applied — is not directly verified. A future hardening test could `db.exec(seedSql)` twice and assert row count stable.

2. **New schemas (`SkillSchema`, `ToolSchema`, `MCPServerSchema`) have no dedicated unit tests in `packages/shared`.**
   Coverage is only via the server integration tests (`every row parses against …Schema`). The existing `packages/shared/src/__tests__/equipment.test.ts` covers `EquipmentSchema` directly but was not extended. Not required by the spec; flagging as a follow-up candidate.

3. **`createdAt: z.string()` is loose.**
   The spec describes `createdAt` as "ISO" but the DB produces `YYYY-MM-DD HH:MM:SS` from `datetime('now')` (no `T` separator, no timezone). The schema accepts it because `z.string()` is unconstrained. This is consistent with the existing `Adventurer`, `Epic`, and `Quest` schemas — a project-wide pattern, not citrine-introduced. Worth addressing globally in a future cleanup, not as a citrine bug.

4. **`created_by` has no CHECK constraint at the DB level, but `SkillCreatedBySchema` is `enum(['system','user'])`.**
   Pre-existing from Phase 1 migration (line 98 of `001_init.sql`). Citrine is read-only with hardcoded `'system'` seeds, so no real risk surfaces in this task. When a write API for skills lands (post-Phase 3), either the DB CHECK should be added or the schema should widen. Flagging now for visibility.

5. **`JSON.parse` in `rowToApi` has no try/catch.**
   If `monster_type_ids_json` or `config_json` is ever malformed, the parse throws and the request 500s via the error middleware. Acceptable because data is migration-controlled. If/when user-write endpoints land, this should validate via the Zod schema after parse.

## Files Reviewed (no bugs filed)

- `packages/shared/src/equipment.ts` — new schemas defined cleanly
- `packages/shared/src/index.ts` — re-exports complete
- `packages/server/src/routes/skills.ts` — clean read-only handler, correct camelCase mapping
- `packages/server/src/routes/tools.ts` — clean
- `packages/server/src/routes/mcp-servers.ts` — clean, `config_json` parsed to object as expected
- `packages/server/src/index.ts` — three routers mounted at correct paths
- `packages/server/src/db/migrations/002_seed_equipment.sql` — `INSERT OR IGNORE` used uniformly; values match schema enums
- `packages/server/src/__tests__/equipment-catalog.test.ts` — 14 tests covering all three endpoints, schema validation, seed content
- `progress.md` — updated correctly

## Final Verdict

**PASS — 0 bugs filed, 5 informational notes.** Code matches spec, all gates green, no rule violations.
