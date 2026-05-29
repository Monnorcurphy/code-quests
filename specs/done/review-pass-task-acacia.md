# Review Pass — TASK acacia (Failure summary engine + scar minting backend)

**Branch:** `feature/acacia`
**Parent:** `main`
**Final verdict:** FAIL — 1 LOW bug filed (`specs/bugs/review-1.md`)

## Checks performed

- Read full diff (server lib, services, tests; shared types; client schema/UI label maps; SQL migration 007).
- Ran `pnpm --filter @code-quests/server test` → 415 passed (30 files).
- Ran `pnpm lint` → no errors.
- Ran `pnpm typecheck` → all 3 packages clean.
- Grepped production source for `console.*` in the new files → none.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) in new files → none.
- Verified `quest_returned` discriminated-union case is present in every exhaustive `AgentEvent` switch (active-quest-panel, returned-quest-detail).
- Verified `returned_to_town` and `retired` are present in every exhaustive `Record<QuestStatus, …>` map (party-map, quest-board STATUS_LABELS, STATUS_CLASS).
- Cross-boundary review:
  - Backend `FailureSummarySchema` (shared) and client `failureSummary` schema in `packages/client/src/lib/api.ts` were compared field-by-field; recommendation enum values match exactly (`retry`, `repost_with_clarification`, `retire`, `break_into_smaller`, `level_up_first`).
  - SQL `CHECK(status IN (...))` in migration 007 was diffed against `QuestStatusSchema`'s 8 values — exact match.
  - SQL `CHECK(current_scene IN (...))` matches `QuestSceneKeySchema`.
- Migration 007 review: `PRAGMA foreign_keys = OFF` is placed *outside* the explicit `BEGIN/COMMIT`, which is required by SQLite (the pragma is a no-op inside a transaction); restoration to ON is also outside the transaction. All 20 columns (incl. the migration-005 `current_scene` column) are preserved in the INSERT. No indexes/triggers/views on `quests` would be lost.
- Verified the connection-level `PRAGMA foreign_keys = ON` is set by `openDb()` before `runMigrations` runs, so the new migration's pragma toggle is harmless.

## Bugs filed

- `specs/bugs/review-1.md` (LOW) — `failure-summary.test.ts` line 193 has a test labelled "returns retire when no agents and no encounters" inside the `describe('recommendation: retire')` block, but the assertion expects `repost_with_clarification`. Either move/rename the test, or change the implementation to actually return `retire` for the zero-input edge case (latter is more spec-aligned).

## Informational notes (no bug filed)

1. **`fatalEncounterId` is `''` rather than `undefined` when no defeats exist.** The Zod schema marks it `optional()`, which idiomatically implies absence as `undefined`. Empty string is a valid string but a downstream consumer testing `if (fs.fatalEncounterId)` will get `false` for both cases anyway. Cosmetic — not a bug.

2. **`parseQuestRow` in `quest-return.ts` hard-codes `inputRequest: null, userBlocker: null`.** It reads `input_request_json` / `user_blocker_json` via `SELECT q.*` but discards them. Not a bug for this service (the failure summary doesn't need them), but a future caller of `parseQuestRow` outside this service would silently lose data. Could be simplified to either parse them properly or stop selecting them.

3. **Atomicity test (`'rolls back all writes when the status transition fails'`) does not exercise true rollback.** The test triggers the throw via the `status='failed'` guard returning `changes=0`, so no INSERT/UPDATE writes occur before the throw — there is nothing to roll back. A stronger test would force a failure *after* the first UPDATE succeeded (e.g., make the adventurer `scars_json` update violate a constraint) and verify the quest update is rolled back. Spec acceptance criteria are technically met because the test asserts the post-state is clean.

4. **Client `failureSummary` schema in `packages/client/src/lib/api.ts` duplicates `FailureSummarySchema` from `@code-quests/shared`.** Per `rules/cross-boundary.md` ("Shared Constants — Single Source of Truth"), the shared schema should be imported instead of re-declared. This duplication pre-dates this task — the existing client schema was already inline before this PR — so not blocking. Worth a follow-up cleanup.

5. **`retry` is in `FailureSummaryRecommendationSchema` but `buildFailureSummary` never returns it.** Pre-existing enum value; either consumers should produce it (TASK alder might?) or it should be removed. Not in scope for this task.

6. **`quest_returned` event icon (🏰) collides with `status_change` icon in `active-quest-panel.tsx`.** Visual ambiguity only; the text differentiates them and screen-readers read text not icons. Cosmetic.

## Spec alignment

All acceptance criteria from `metrics/task-acacia-context.md` are met:

- ✓ `buildFailureSummary` covered by unit tests for every recommendation branch (level_up_first, break_into_smaller, repost_with_clarification, retire) and several edge cases.
- ✓ `mintScar` covered for both "scar" and "no scar" branches including grace-period boundaries.
- ✓ `quest-return.test.ts` uses a real in-memory SQLite DB; asserts status flip, `failure_summary_json`, scars list growth, atomicity (modulo the note above), and FK enforcement.
- ✓ WebSocket event `quest_returned` carries `{ questId, failureSummary, scarAdded: boolean }`.
- ✓ No `console.*` in production source.
- ✓ All writes inside a single `db.transaction()`; the WebSocket emit happens *after* the transaction succeeds (correct ordering — never emits a notification for a rolled-back change).
