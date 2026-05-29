# Review Pass — Task alder (Hall of Returns API)

## Verdict: PASS (0 bugs filed)

## Summary of checks performed

- Read the full diff: `hall-of-returns.ts`, `quest-actions.ts`, `return-actions.ts`, `agent.ts` extension, two new test files, client formatter updates, and the `index.ts` wiring.
- Read the task spec at `metrics/task-alder-context.md`.
- Read `migrations/007_quest_status_phase9.sql` to verify status enum boundaries.
- Ran `pnpm --filter @code-quests/server test` — 461 tests pass.
- Ran typecheck (server, shared, client) — clean.
- Ran `pnpm --filter @code-quests/server lint` — clean.
- Ran `./scripts/verify.sh` — 6 passed, 0 hard fails. The "No debug prints" WARN is pre-existing (not introduced by this task; new files contain no `console.log`/`print(`/etc.).
- Greped new files for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) — none.
- Verified all schemas in `return-actions.ts` apply Zod validation at the boundary via the `validate` middleware (with field-named 400 errors per `rules/input-validation.md`).
- Verified status guards on `repost`/`retire`/`split` against DB CHECK constraint values (`returned_to_town` matches both schema and migration 007).

## Cross-boundary verification

- DB CHECK on `quests.status`: `('idle','active','complete','failed','paused_input','user_blocked','returned_to_town','retired')`.
- New quest status from `repost`/`split` = `'idle'` — valid against DB.
- New quest status from `retire` = `'retired'` — valid against DB.
- Hall list endpoint validates `status ∈ {returned_to_town, complete}` — both valid DB values.
- New event types in `AgentEventSchema` (`quest_reposted`, `quest_retired`, `quest_split`, `quest_feedback_added`) are matched in both client formatters (`active-quest-panel.tsx`, `returned-quest-detail.tsx`), exhausting the discriminated union.

## Test coverage check (against spec criteria)

- ✅ Happy path for all 4 actions
- ✅ Every validation error (empty text, oversize text, missing field, fewer than 2 split children, invalid status filter)
- ✅ State guards (409 on non-`returned_to_town` repost/retire/split)
- ✅ Idempotency for retire (called twice → both 200, status `retired`)
- ✅ Feedback append semantics (existing entries preserved)
- ✅ Cursor pagination for Hall list
- ✅ 404 paths for unknown quests on all endpoints

## INFORMATIONAL notes

1. **Spec says "new quest status = `posted`", implementation uses `'idle'`.** The DB CHECK constraint does not include a `'posted'` value, so `'idle'` is the only technically valid choice; the spec was using `posted` colloquially. This matches the existing convention used throughout the codebase (e.g., `QuestSchema.status.default('idle')`). No code change recommended, but if a future task assumes a literal `posted` state exists, this gap will need a migration.

2. **WebSocket emission is not exercised by tests.** The two test suites pass no `getChannel` to `createQuestActionsRouter`, so the publish branches are unreached in coverage. The router code itself is trivial (4 `publishQuestEvent` calls with hand-typed payloads against the discriminated union), and the channel itself has its own tests in `quest-channel.test.ts`. Consider adding a smoke test with a fake channel that records emitted events — left as future improvement, not filed.

3. **No test for the `fatalMonster` field in Hall list response.** The list endpoint's SELECT includes a fairly complex correlated subquery that joins `monster_encounters → monsters → monster_types` to surface the most recent `defeat` encounter as `fatalMonster`. No test validates this output shape. Worth adding when this field starts driving UI.

4. **Retire idempotency does not re-emit `quest_retired`.** Calling retire a second time on an already-retired quest returns 200 (per spec) but no event is published. This is a reasonable interpretation of idempotency ("no duplicate state, no duplicate side-effects") but is not explicitly specified. If subscribers need a heartbeat-style signal even for no-op retires, the implementation would need a small change.

5. **Cursor pagination uses strict `<` on `updated_at`.** Two quests written in the same millisecond could cause one to be skipped at a page boundary. In practice `new Date().toISOString()` is millisecond-precise and the existing UPDATE patterns make collisions unlikely; the existing tests use distinct timestamps. A composite cursor (timestamp+id) would be more robust if real-world collision rates become a concern.

6. **`repost` parses then re-stringifies `acceptance_criteria_json`/`edge_cases_json` even when the caller provides no adjustment.** Pure efficiency nit; passing through the source JSON string when no adjustment is given would skip a round-trip. Not filed.

## Files reviewed

- `packages/server/src/routes/hall-of-returns.ts` (new, 245 lines)
- `packages/server/src/routes/quest-actions.ts` (new, 294 lines)
- `packages/server/src/__tests__/hall-of-returns.test.ts` (new, 309 lines, 19 tests)
- `packages/server/src/__tests__/quest-actions.test.ts` (new, 424 lines, 25 tests)
- `packages/shared/src/return-actions.ts` (new, 38 lines)
- `packages/shared/src/agent.ts` (extended with 4 new event variants)
- `packages/shared/src/quest.ts` (added `splitIntoQuestIds?` to FailureSummary)
- `packages/shared/src/index.ts` (re-exports)
- `packages/server/src/index.ts` (router mount)
- `packages/client/src/features/quests/active-quest-panel.tsx` (formatter cases)
- `packages/client/src/features/quests/returned-quest-detail.tsx` (formatter cases)
- `progress.md`

## Final verdict

**PASS — 0 bug files filed.** Implementation matches spec acceptance criteria, tests are thorough where it matters (happy path, all validation errors, state guards, idempotency, append semantics, cursor pagination), boundary contracts hold, and verify is green. INFORMATIONAL notes above flag follow-ups but none rise to LOW.
