# Review Pass — task calypso (Monsters / encounters REST API)

## Checks performed

- Read pre-computed diff (7 files, +458/-15 lines): shared schemas, server router,
  server tests, client API wrappers, app wiring.
- Read `packages/server/src/routes/monsters.ts`,
  `packages/server/src/routes/__tests__/monsters.test.ts`,
  `packages/server/src/routes/quests.ts` (full file, to check routing conflicts with
  the `/quests/:questId/encounters` route mounted by the new router),
  `packages/server/src/services/monster-types.ts`,
  `packages/server/src/db/migrations/001_init.sql`,
  `packages/server/src/db/migrations/006_monster_types_seed.sql`,
  `packages/server/src/db/connection.ts`,
  `packages/shared/src/monster.ts`,
  `packages/client/src/lib/api.ts`,
  `packages/server/src/index.ts`.
- Ran `pnpm --filter @code-quests/server test` → 293/293 passing, including the
  new monsters test file (29 new assertions across 5 describe blocks).
- Ran `tsc --noEmit` in shared, server, client → all clean.
- Ran `eslint` in shared, server, client → all clean.
- Cross-boundary check: verified DB CHECK constraints
  (`scope IN ('project','guild')`, `outcome IN ('victory','defeat','escape')`)
  against the Zod schemas — both match exactly. `MonsterEncounterSchema.outcome`
  enums and `MonsterScopeSchema` enums are identical to the DB CHECK lists.
- Cross-boundary check: verified `rowToMonster` / `rowToEncounter` field names
  map snake_case → camelCase correctly and cover every column the schema requires.
  All fields present.
- Cross-boundary check: FK enforcement — `db.pragma('foreign_keys = ON')` runs in
  `openDb()` and applies to `:memory:` test DBs.
- Verified the route mount precedence. Express tries `app.use('/quests', questsRouter)`
  first; none of its GET routes (`/active`, `/`, `/returned`, `/:id`) match
  `/quests/:questId/encounters`, so the request falls through to
  `app.use('/', createMonstersRouter)`. Works correctly today.
- Secret scan: no `sk-`, `AKIA`, `api_key`, or `password=` strings introduced.
- No new `console.log` / `console.error` calls.
- Empty-array behavior: every list endpoint returns `[]`, never `null`, and tests
  cover the empty case for each (`/monsters`, `/monsters/:id/encounters`,
  `/quests/:questId/encounters`).
- 400 path: `?scope=enemy` returns `{ error, field: 'scope' }` with a message
  that names the field and the expected values (per `input-validation.md`).

## Bugs filed

- `specs/bugs/review-1.md` — LOW: client `monsters.list` accepts `scope: string`
  instead of `MonsterScope` enum (cross-boundary type-safety regression).

## INFORMATIONAL notes (not bugs — future considerations)

1. **Router mount path.** `createMonstersRouter` is mounted at `/` rather than at a
   dedicated prefix because it owns three different URL roots (`/monster-types`,
   `/monsters`, `/quests/:questId/encounters`). It works today and there are no
   conflicts, but a future GET route `/quests/:id/encounters` added to
   `questsRouter` would shadow it silently. If a follow-up task adds quest-side
   encounter endpoints, consider splitting the quest-encounters route into the
   quests router instead.

2. **Asymmetric 404 behavior across the two encounter endpoints.**
   `GET /monsters/:id/encounters` checks the monster exists and returns 404 if not;
   `GET /quests/:questId/encounters` does not check the quest exists and just
   returns `[]`. The spec only requires "404 on unknown monster" and the tests
   explicitly assert the empty-array behavior for unknown quests, so this matches
   spec — but if the bestiary UI grows to display "quest not found" states, the
   client will need a separate quest lookup.

3. **`JSON.parse` in `rowToEncounter` is unguarded.** `combat_log_json` and
   `loot_json` are parsed without try/catch. The DB defaults to `'[]'` and the
   columns are `NOT NULL`, so the only way to crash this is direct DB tampering
   or a future migration that writes invalid JSON. Defensive parsing isn't
   required, but worth noting if write-side code ever produces these values.

4. **`monster_types.created_by` lacks a DB CHECK constraint.** Column is
   `TEXT NOT NULL DEFAULT 'system'` with no `CHECK(created_by IN ('system','user'))`,
   but `MonsterTypeSchema.createdBy` is `z.enum(['system', 'user'])`. Today only
   the seed migration writes this column (always `'system'`), so it's consistent.
   When a future task adds user-created monster types, either add a CHECK to the
   DB or ensure the write path uses an enum on the backend; otherwise an invalid
   value will only surface as a frontend Zod parse failure.

## Verdict

**FAIL — 1 LOW bug filed.**

The implementation matches the spec, all checks pass, and the new tests cover
every acceptance criterion. The single bug is a type-safety improvement, not a
runtime defect — the server enforces the constraint correctly at the boundary.
