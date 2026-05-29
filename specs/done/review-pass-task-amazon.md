# Review Pass — task amazon

**Verdict:** PASS (0 bugs filed)

## Scope

Task amazon (Phase 10): Skill candidate detection service. Adds a service that
auto-creates `skills` rows with `status='candidate'` once an adventurer has
defeated a given monster type `CANDIDATE_VICTORY_THRESHOLD (=3)` times, and
wires it into `resolveEncounter` for the victory path.

Files reviewed in diff:
- `packages/server/src/db/migrations/008_skill_candidates.sql`
- `packages/server/src/services/skill-candidate-detection.ts`
- `packages/server/src/services/monster-detection.ts` (resolveEncounter hook only)
- `packages/server/src/services/__tests__/skill-candidate-detection.test.ts`
- `progress.md` (Phase 9 → Phase 10 swap + archive note)

## Checks performed

1. **Spec conformance** — All acceptance criteria satisfied:
   - Migration adds `detected_for_adventurer_id TEXT REFERENCES adventurers(id)`,
     `last_detection_at TEXT`, and `idx_skills_status_typeids ON skills(status)`.
   - `CANDIDATE_VICTORY_THRESHOLD = 3` exported and consumed by tests
     (no magic 3 literals in test assertions).
   - Detection is per-adventurer × per-monster-type (SQL joins via
     `quests.adventurer_id`).
   - FK pragma test inserts with `detected_for_adventurer_id='nonexistent-adv'`
     and asserts `.toThrow()`.
2. **Cross-boundary validation**:
   - `skills.status` CHECK is `('candidate', 'active', 'retired')` — code only
     ever inserts `'candidate'` and queries for `'active' | 'retired' | 'candidate'`. ✓
   - `created_by` has no CHECK constraint but the existing convention is
     `'system' | 'user'`; code inserts `'system'`. ✓
   - `monster_type_ids_json` stored via `JSON.stringify([monsterTypeId])`;
     queried via `json_each(...)`. Round-trips correctly. ✓
3. **FK enforcement** — `openDb` sets `PRAGMA foreign_keys = ON` for both
   production (`~/.code-quests/db.sqlite`) and `:memory:` test DBs. The
   regression test exercises this. ✓
4. **Idempotency** — `migrator.ts` records applied versions in
   `schema_migrations`, so `ALTER TABLE ADD COLUMN` won't run twice.
5. **Test suite** — `pnpm --filter @code-quests/server test`: **482 / 482
   passing** (was 476 before this task; +6 = 1 FK assertion test on top of
   the 5 the spec listed).
6. **Lint** — `pnpm --filter @code-quests/server lint`: clean.
7. **Typecheck** — `pnpm --filter @code-quests/server typecheck`: clean.
8. **Secrets** — grep for `sk-`, `AKIA`, `api_key`, `password=` in new files:
   none.
9. **Debug output** — new files contain no `console.log` / `process.stderr`
   / `print` statements.
10. **SQL injection** — all queries use parameterized `.run(...)` / `.get(...)`.
11. **Existing consumers** — `packages/server/src/routes/skills.ts` uses
    `SELECT *` with a typed `SkillRow` and a `rowToApi` mapper. The new
    columns are silently ignored in the API response, which doesn't break
    any existing consumers (TS doesn't validate `SELECT *` row shape).
12. **resolveEncounter integration** — the new call site:
    - Reads `monster.type_id` and `quest.adventurer_id` AFTER the encounter
      is marked `'victory'`, so `evaluateSkillCandidate`'s COUNT query
      includes the just-resolved encounter (correct).
    - Guarded by `if (monsterTypeRow?.type_id && questRow?.adventurer_id)`,
      so quests without an adventurer (none currently expected, but defensive)
      don't crash.

## INFORMATIONAL notes (not bugs)

- **API does not expose the new columns.** `GET /skills` (`routes/skills.ts`)
  uses a fixed `SkillRow` type and `rowToApi` mapping that omit
  `detected_for_adventurer_id` and `last_detection_at`. The detection
  service writes them, but UI consumers can't read them yet. Out of scope
  for this task; a future task that surfaces auto-detected candidates in
  the Library will need to extend the row mapper.
- **Index name vs. columns.** `idx_skills_status_typeids` is the name in the
  migration and matches the spec verbatim, but the index is on `(status)`
  only — the "typeids" portion of the name is aspirational. If candidate
  lookups become a hotspot, a compound index or a covering index on
  `(status)` + a generated column for type ids might help. Spec match → not
  a bug.
- **Timestamp format drift within `skills` row.** `created_at` uses SQLite's
  `datetime('now')` (`'YYYY-MM-DD HH:MM:SS'`); `last_detection_at` uses
  Node's `new Date().toISOString()` (`'YYYY-MM-DDTHH:MM:SS.sssZ'`).
  Both stored as TEXT, both sort lexicographically correctly within their
  own column, so this only matters if anyone later does `WHERE created_at
  = last_detection_at` or similar. Worth standardising in a future cleanup.
- **No transaction around count → check → insert/update.** Three statements
  separated by JS-level branches. better-sqlite3 is synchronous and Node is
  single-threaded, so within one process this is safe. If the server ever
  forks workers, wrap the sequence in `db.transaction(...)` to avoid
  double-inserts.
- **`progress.md` rewrite.** Phase 9 section replaced wholesale with the
  Phase 10 amazon entry, and "Previous task progress archived to
  metrics/progress-before-amazon.md" is honoured (`metrics/progress-before-amazon.md`
  exists). This follows the context-policy archive rule.

## Final verdict

**PASS — 0 bugs filed.**
The implementation matches every acceptance criterion in
`metrics/task-amazon-context.md`, all 482 server tests pass, lint and
typecheck are clean, and no security / boundary / accessibility issues
were found in the diff.
