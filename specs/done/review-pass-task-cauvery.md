# Review Pass — task cauvery (Custom monster types API + detection integration)

**Verdict:** FAIL — 1 bug filed (LOW)

## Checks performed

- Read the task spec at `metrics/task-cauvery-context.md`.
- Read the pre-computed diff.
- Read `packages/server/src/db/migrations/001_init.sql` and `006_monster_types_seed.sql` to verify the rebuild migration preserves the column list and seed data.
- Read `packages/server/src/db/migrator.ts` and `packages/server/src/db/connection.ts` to verify `PRAGMA foreign_keys = OFF/ON` in migration 009 is safe (migrator does not wrap each migration in a transaction, so the pragma takes effect).
- Read `packages/server/src/services/monster-types.ts`, `monster-detection.ts`, `routes/monsters.ts`, the new shared schema, the route test, and the detection test.
- Read `packages/client/src/lib/api.ts` to verify the new `createType` is wired and re-exports are correct.
- Ran `pnpm --filter @code-quests/server test`: **514 passed**.
- Ran `pnpm --filter @code-quests/server typecheck`: clean.
- Ran `pnpm --filter @code-quests/server lint`: clean.
- Ran `pnpm --filter @code-quests/client typecheck`: clean.
- Ran `pnpm --filter @code-quests/client lint`: clean.
- Ran `pnpm --filter @code-quests/shared test`: 83 passed.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`): none.
- Verified cross-boundary value consistency: DB CHECK `created_by IN ('system','user')` matches `MonsterTypeSchema.createdBy = z.enum(['system','user'])` in `packages/shared/src/monster.ts`. Route inserts `'user'` literal, schema validates server response.
- Verified the new test `CHECK constraint rejects created_by other than system/user` exercises the constraint directly (not mocked).
- Verified `validateFailureSignature` is used in both the route (via Zod `superRefine`) and the classifier (via direct call), satisfying the spec's "used by both" requirement.

## Bugs filed

- `specs/bugs/review-1.md` — LOW — `slugify()` returns empty string for non-ASCII or pure-symbol names, causing distinct names to collide on id `'user:'` and produce a misleading 409 "name already exists" error.

## Informational notes (not filed)

1. **Double `new RegExp` per type in `classifyCombatEvent`.** `validateFailureSignature(pattern)` calls `new RegExp(pattern)`, and on success the loop immediately calls `new RegExp(pattern, 'i')` again to test. The flag has no effect on validity. A future cleanup could return the constructed RegExp from the validator (or cache it on a precomputed list) and use it directly. Trivial — not filed.

2. **Invalid-regex log fires per `classifyCombatEvent` call.** The spec's acceptance criterion says "logged once" — the structured log line is emitted on every classification attempt, which can spam logs if a corrupted user-defined regex sits in the DB. Reading the spec charitably ("logged as one structured event per occurrence, not via `console.log`"), the current behavior is acceptable. If "once" is interpreted strictly, a one-time dedup (e.g., a per-type "already logged" set kept on the connection) would be needed. Not filed — the spec is ambiguous and the current behavior satisfies the structural-log-not-`console.log` requirement.

3. **400 response body leaks Zod issue shape.** The route's 400 body includes `details: parsed.error.issues`. This is useful for client-side error rendering but tightly couples API consumers to Zod's internal issue format. Matches the pattern already established elsewhere in this codebase (e.g., the existing `promote-nemesis` handler in the same file). Not a bug.

4. **`CreateMonsterTypeSchema.parse(input)` is called in `api.monsters.createType` before `postJson`.** If `input` is invalid (e.g., bad regex), this throws a `ZodError` synchronously rather than returning a clean rejected Promise. Acceptable — matches the input-validation rule (validate at the boundary) — but UI code consuming this should be ready to surface the issue.

## Verdict

1 LOW bug filed. All tests, typecheck, and lint pass. Migration is safe; cross-boundary contracts match; the classifier correctly skips invalid user-supplied regexes with a structured log.
