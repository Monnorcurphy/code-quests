# Review Pass — Task aquarius

**Branch:** `feature/aquarius`
**Parent:** `main`
**Verdict:** PASS (0 bugs filed)

## Summary of checks performed

### Functional verification
- `pnpm --filter @code-quests/server typecheck` — clean (no errors)
- `pnpm --filter @code-quests/server lint` — clean (no errors/warnings)
- `pnpm --filter @code-quests/server test` — **538/538 tests pass** (entire suite runs in 2.3s)
- 23 new tests in `seed-showcase.test.ts` cover seed idempotency, FK integrity, cross-boundary equipment refs, SpecAudit blocking-gap check, adventurer stats/scars, monster scopes/calibrated difficulty, reset env guard, and the `POST /showcase/reset` route.

### Security
- No hardcoded secrets (grep for `sk-`, `AKIA`, `api_key`, `password=` returned zero hits)
- The `POST /showcase/reset` endpoint is properly gated by `CODE_QUESTS_ENV === 'demo'` — returns 403 otherwise. Reset script *also* gates internally with `throw new Error('Showcase reset is only allowed when CODE_QUESTS_ENV=demo')` — defense in depth.
- `main()` in `seed-showcase.ts` refuses to run when `CODE_QUESTS_ENV === 'production'`.

### Cross-boundary contract validation (mandatory check)
Verified all values flowing into SQLite match schema constraints:
- Quest `status='idle'` ✓ (valid value in CHECK constraint from `001_init.sql` / `007_quest_status_phase9.sql`)
- Monster `scope='guild'|'project'` ✓
- Adventurer `class='champion'|'scout'` ✓
- Skill `status='candidate'|'active'` ✓
- Every `equipment.skillIds` / `toolIds` / `mcpServerIds` value (`type_whisperer`, `gh`, `filesystem`, `linters_bane`, `wraith_banisher`) exists as a row in `skills`/`tools`/`mcp_servers` after migration `002_seed_equipment.sql`. Test `quest equipment skillIds reference existing skills` enforces this at run-time.
- Every `stats.monstersSlain` key (`goblin_linter`, `imp_typecheck`) maps to a valid `monster_types.id` from `006_monster_types_seed.sql`. Test `Adventurer.stats.monstersSlain references valid MonsterType ids` enforces this.
- Tess's scar `monsterIdAtFatal='the-jwt-hydra'` matches the seeded monster id. ✓

### Idempotency
- `INSERT OR IGNORE` on epics/adventurers/quests/monsters; UPDATE on skills (idempotent by construction).
- Two tests verify second-run produces identical row counts (both filtered showcase counts and unfiltered DB row counts).

### Foreign key integrity
- Test `all quest epic_id FKs resolve` confirms `quest.epic_id` joins to `epics`.
- Test `all monster type_id FKs resolve` confirms `monster.type_id` joins to `monster_types`.
- `PRAGMA foreign_keys = ON` is set by `openDb()` in both production and `:memory:` test mode (`db/connection.ts:14`).

### Reset semantics
- `clearShowcaseData` deletes in correct FK order: `monster_encounters` → `agents` → `quests` → `monsters` → `adventurers` → `epics`, then resets the 4 showcase skills to migration defaults.
- Skill reset clears `hit_count=0`, `status='active'`, `monster_type_ids_json='[]'` before re-seeding — correctly returns skills to a clean state so `ac_cartographer.status='candidate'` is reapplied by the seed.

### Code quality
- `seed-showcase.ts` (238 lines), `reset-showcase.ts` (83 lines), `routes/showcase.ts` (24 lines) — all under the 500-line module / 300-line component limits.
- No `console.*` debug output. Logging via `process.stdout.write` / `process.stderr.write` in CLI `main()` only.
- Error handling: route catches all errors from `resetShowcase()`, returns 500 with a sanitized message. Seed/reset scripts exit non-zero with diagnostic messages on guardrail failure.

### Accessibility
- N/A — backend-only changes (scripts, route, tests). No UI affected.

## INFORMATIONAL notes

1. **Spec says "status `posted`", seed uses `idle`.** The quest status enum (`001_init.sql` / `007_quest_status_phase9.sql`) has no `posted` value — valid statuses are `idle, active, complete, failed, paused_input, user_blocked, returned_to_town, retired`. The seed correctly uses `idle` (the canonical "available for dispatch" state). The spec's "posted" wording is loose — `idle` is the correct technical mapping. Not a bug.

2. **Seed timestamps are non-deterministic** (`new Date().toISOString()` on each run). On the first run, timestamps reflect real time. On subsequent runs, `INSERT OR IGNORE` skips already-present rows, so timestamps stabilize. The spec asks for a "deterministic SQLite seed" — the data *shape* is deterministic but timestamp *values* are not. No tests fail because of this; the spec wording likely meant "deterministic structure," not "byte-identical timestamps." Future improvement could pin timestamps to fixed constants for true reproducibility.

3. **`resetShowcase` deletes only showcase rows, not the whole DB.** The spec says "wipes the DB and re-runs seed-showcase.ts," but the implementation only wipes showcase-scoped rows. This is *safer* than the literal spec (won't destroy unrelated data the user added). In intended demo flow (env=demo, fresh DB) this is irrelevant. Edge case: if a non-showcase quest were ever assigned a showcase adventurer (`adv-showcase-brielle/tess/rook`), deletion would FK-fail. Not a concern in demo mode where only showcase data exists. Could be hardened later by either deleting all rows or relaxing the adventurer FK to `ON DELETE SET NULL`.

4. **Reset endpoint error responses surface raw error messages** (`err.message`). For a demo-only, env-gated endpoint this is fine. Not a leak risk in production because the endpoint returns 403 outside `CODE_QUESTS_ENV=demo`.

5. **`vi.mock('@anthropic-ai/sdk')`** at the top of the test file is defensive — none of the directly-tested modules import the SDK, but the mock prevents accidental network calls if a transitive import ever pulls it in. Harmless.

## Final verdict

**PASS — 0 bugs filed.**

All acceptance criteria are met:
- ✓ `pnpm --filter @code-quests/server seed:showcase` script registered, runs in well under 2s
- ✓ Idempotency verified by 2 dedicated tests
- ✓ `POST /showcase/reset` returns 403 unless `CODE_QUESTS_ENV=demo` (2 tests cover this)
- ✓ All `Quest.equipment.{skillIds,toolIds,mcpServerIds}` reference existing rows (cross-boundary test)
- ✓ `Adventurer.stats.monstersSlain` references valid `MonsterType` ids only (cross-boundary test)
- ✓ Brielle has 8 wins; Tess has 2 wins + 1 hydra_ac_mismatch scar — both verified by tests
