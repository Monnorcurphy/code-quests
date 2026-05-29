# Review Pass — Task amur (Skills REST API)

**Verdict:** PASS (0 bugs filed)

## Summary of checks performed

- Read pre-computed diff for branch `feature/amur` vs `feature/amazon` (6 files, 426/-11 lines)
- Read task spec at `metrics/task-amur-context.md`
- Inspected `packages/server/src/routes/skills.ts`, `packages/server/src/routes/__tests__/skills.test.ts`, `packages/shared/src/skill-actions.ts`, `packages/client/src/lib/api.ts`
- Verified the `validate` middleware behaviour (`packages/server/src/middleware/validate.ts`) and confirmed Zod path → `field` reporting matches the spec contract
- Read the `skills` DB schema (`packages/server/src/db/migrations/001_init.sql:92-102`) — `CHECK(status IN ('candidate','active','retired'))`
- Read `packages/server/src/db/connection.ts` — `PRAGMA foreign_keys = ON` is set for production and `:memory:` test instances
- Verified migration 002 seeds `linters_bane` (used in the GET happy-path test)
- Ran `pnpm --filter @code-quests/server test` — 506 passed, 0 failed in the run that included the new skills suite
  - Note: a single unrelated split-action test in `quest-actions.test.ts` failed transiently on one run and passed on the next. It is unchanged from the parent branch (`git diff feature/amazon..feature/amur -- packages/server/src/__tests__/quest-actions.test.ts packages/server/src/routes/quests.ts` is empty) and not introduced by this task.
- Ran `pnpm --filter @code-quests/client test` — 918 passed
- Ran `tsc --noEmit` across server, shared, and client — clean
- Ran `eslint` across server, shared, and client — clean
- Grep for hardcoded secrets in new files — none

## Cross-boundary checks

- DB enum `status IN ('candidate','active','retired')` matches:
  - Server `StatusQuerySchema = z.enum(['active','candidate','retired'])`
  - Shared `SkillStatusSchema = z.enum(['candidate','active','retired'])`
  - Client query string accepts the same three values
- DB `created_by` defaults to `'system'`; forge route hard-codes `'user'`; both values are allowed by shared `SkillCreatedBySchema = z.enum(['system','user'])`
- New `INSERT INTO skills` writes `status='active', created_by='user', hit_count=0` — all valid under the CHECK and the shared Zod schema; `rowToApi` output round-trips through `SkillSchema` cleanly on the client
- `ForgeSkillSchema` (shared) is used by both the server `validate()` middleware and the client `forge()` helper — single source of truth as required by the spec

## Contract spot-checks

- `POST /skills` returns 201 with the created row (test: `creates a skill and returns 201`)
- `POST /skills/:id/confirm` flips candidate → active and preserves `name` / `implementation` when not overridden (covered by `confirms a candidate and flips to active` and `overrides name and implementation when provided`)
- `POST /skills/:id/dismiss` hard-deletes only candidates and returns 204; otherwise 400/404
- `POST /skills/:id/retire` flips active → retired only; 400 for candidate/retired, 404 for unknown
- `GET /skills?status=` rejects unknown values with `{ field: 'status' }`
- 404 is returned before 400 in the lifecycle endpoints (existence checked before state)
- Routes use bracket-access on `req.params['id']` consistent with `noPropertyAccessFromIndexSignature` settings
- No `console.log` introduced in production source

## INFORMATIONAL notes (no bug filed)

1. **`api.skills.forge` re-parses input client-side via `ForgeSkillSchema.parse(input)`.** If the caller passes structurally invalid data (e.g., whitespace-only `name` that trims to empty), this throws a raw `ZodError` rather than the project's `ApiError`. UI callers that expect uniform error handling may need to handle that case. The same applies to `confirmCandidate`. Not blocking — most callers will pre-validate at the form layer.

2. **Forge endpoint validates `monsterTypeIds` with N individual SELECTs** (one per id). Loadouts are small so this is fine, but a single `SELECT id FROM monster_types WHERE id IN (?, ?, ...)` would be slightly more efficient. Future polish.

3. **`api.equipment.skills` still calls `GET /skills` with no filter** and so will surface candidate / retired skills in the loadout panel. This is preexisting behaviour (not introduced by amur); the upcoming Library UI work should probably switch to `api.skills.list({ status: 'active' })` for the equipping flow.

4. **Confirm endpoint isn't transactional.** SELECT → UPDATE → SELECT runs as three statements. SQLite serializes writes within a single process so a practical race is unlikely, but wrapping the lifecycle endpoints in a transaction would be cleaner.

5. **No test asserts that confirming with an empty body preserves the original `name`.** Implementation is correct (`input.name ?? row.name`), but the assertion is missing from `confirms a candidate and flips to active`. Minor coverage gap.

None of the above rise to LOW severity. All acceptance criteria from `metrics/task-amur-context.md` are met.

## Final verdict

**PASS** — 0 bugs filed. Tests, lint, typecheck all green. Boundary contracts validated. Cleared for merge.
