# Review Pass — task edinburgh (dispatch wiring + quest lifecycle endpoints)

## Checks performed

- Read full task spec at `metrics/task-edinburgh-context.md`.
- Read pre-computed diff (server: `quest-runner.ts`, `quest-status.ts`, `routes/quests.ts`, two new test files; shared: `quest.ts` adds `FailureSummarySchema` + export; client tests: added `failureSummary: null` to `Quest` test fixtures).
- Read all source touched by the diff plus collaborators that were NOT in the diff but matter for the boundary contract: `agents/offline-adapter.ts`, `agents/cc-adapter.ts`, `agents/adapter.ts`, `agents/select-adapter.ts`, `services/agents-service.ts`, `realtime/quest-channel.ts`, `db/migrations/001_init.sql`, `shared/src/quest.ts`, `shared/src/agent.ts`, `shared/src/equipment.ts`, `index.ts` (server entrypoint), `__tests__/dispatch.test.ts` (Phase 3 baseline).
- `pnpm typecheck` — pass, no errors across shared/server/client.
- `pnpm lint` — exit 0, no warnings.
- `pnpm test` — 5/5 + 17/17 + 25/25 test files pass (193 server tests, 277 client tests, 58 shared tests).
- `pnpm build` — pass for all three packages.
- Cross-boundary spot checks:
  - `quests.status` CHECK constraint enum (`idle | active | complete | failed | paused_input | user_blocked`) ↔ `QuestStatusSchema` ↔ status strings written by `transitionQuestStatus`, `/complete`, `/fail`, `/cancel`, and `runQuest`. All match.
  - `FailureSummaryRecommendationSchema` enum (`retry | repost_with_clarification | retire`) ↔ values written by `runQuest` (`repost_with_clarification`), `/fail` (default `repost_with_clarification` + caller override), `/cancel` (`retire`). All match.
  - `AgentSchema` ↔ `agents` table columns ↔ `findAgentByQuest` mapping ↔ `/active` JOIN columns. All match.
  - `AgentEventSchema` discriminated union ↔ offline adapter emissions ↔ runner branches on `'completed'` / `'failed'`. All match.
- Secret scan: `grep -E 'sk-|AKIA|api_key|password='` over the diff — no hits in product code (the lifecycle test uses the `mocked-key` env via the wider Vitest setup; no secrets in source).
- Accessibility / UI: no UI touched by this task. Client diff is fixture-only (`failureSummary: null` added). No new tailwind classes, no aria-* changes, no focus surfaces — nothing to review for WCAG.

## Findings

### Bugs filed
- **HIGH** `specs/bugs/review-1.md` — failure summary written before guarded transition succeeds. Three call sites (`runQuest` failed branch, `/fail`, `/cancel`) violate the atomic-write contract; concurrent paths can leave `failure_summary_json` attached to a quest whose status moved elsewhere.
- **HIGH** `specs/bugs/review-2.md` — `runQuest` event-loop errors are logged to stderr but never reflected in the row. Quest sticks in `active` with an unended agent and no failure summary. Violates `common-findings.md` #8 (silent error swallowing as visible state).
- **LOW** `specs/bugs/review-3.md` — `combatLog` accumulator + `COMBAT_LOG_MAX_CHARS` constant exist but the buffer is never persisted or read. Either implement persistence (needs a schema column) or delete the dead state.

### INFORMATIONAL notes (no bug filed)

- **End-to-end HTTP dispatch → complete coverage gap.** The acceptance criterion "Dispatching a quest with the offline adapter results in the quest reaching `complete` automatically within ~2s (no manual `/complete` call needed)" is verified at the `runQuest()` unit level (`quest-runner.test.ts`), but no test exercises `POST /quests/:id/dispatch` and asserts the row transitions to `'complete'` after the async loop drains. Adding a polling test (`request().post('/quests/.../dispatch')` then `vi.waitFor(() => row.status === 'complete')`) would close the gap. Not filed as a bug because the underlying behavior is covered.
- **`/cancel` does not verify the cc-adapter's process actually terminates.** The spec's acceptance criterion mentions `process.kill(pid, 0)` "where applicable" — the offline adapter has `pid: null`, so the existing test correctly skips. When the real cc-adapter ships in a later phase, this assertion should be added then.
- **`getActiveHandle`'s `Map` is module-singleton state.** That is fine for a single-process server, but is worth a note: if Phase 11's multi-process work introduces a worker pool, the cancel/handle dispatch must move into a shared store. Tracked here so a future reviewer notices.
- **`/dispatch` response.** `runQuest` returns immediately after spawning, so the response body shows `status: 'active'` (correct per spec). Clients should rely on the WS channel for the eventual `complete`/`failed` transition. The `{ ...rowToApi(finalRow), agentId: agent.id }` spread is redundant (`finalRow.agent_id` is already populated synchronously by `runQuest`) but not wrong.

## Verdict

**FAIL — 3 bugs filed (2 HIGH, 1 LOW).**

The endpoints, schemas, and offline happy-path are in good shape and all existing tests still pass. The blockers are the two HIGH race/error-handling issues; the LOW is cleanup.
