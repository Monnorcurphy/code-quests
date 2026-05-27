# Review Pass — TASK agra-fort: AgentAdapter v2 + agents-table lifecycle service

**Branch:** feature/agra-fort
**Parent:** feature/garnet
**Verdict:** PASS (0 bugs filed)

## Checks Performed

- Read pre-computed diff (11 files, +433 / −13).
- Read task spec at `metrics/task-agra-fort-context.md`.
- Inspected all modified source files: `adapter.ts`, `offline-adapter.ts`, `select-adapter.ts`, `audit-quest.ts`, `agents-service.ts`, `agent.ts`, `index.ts`, plus the new migration and tests.
- Verified shared schemas line up with DB schema (`001_init.sql` agents table: TEXT/INTEGER nullable columns) — `AgentSchema` matches.
- Ran `pnpm test` for `@code-quests/server` (129 passed) and `@code-quests/shared` (58 passed). New tests included (10 + 4).
- Ran `pnpm -r typecheck` — clean.
- Ran `pnpm -r lint` — clean.
- Ran `pnpm -r build` — clean.
- Grepped for `console.`, `sk-`, `AKIA`, `api_key`, `password=`, `child_process`, `@anthropic-ai/sdk` in changed files — only the existing `haiku-adapter.ts` imports `@anthropic-ai/sdk`, which was untouched in this task and explicitly allowed by spec.
- Verified `PRAGMA foreign_keys = ON` is set in `db/connection.ts` and FK violation tests pass.
- Verified `audit-quest.ts` now guards `adapter.complete` with `if (adapter.complete)` since `complete()` became optional — no other callers of `adapter.complete` exist.
- Verified UI/DB/schema boundary alignment for the new `agents` columns.

## Acceptance Criteria Verification

- [x] `AgentAdapter` interface compiles with both `complete()` and `spawn()` optional.
- [x] Existing `auditQuest()` paths still work — guarded with `if (adapter.complete)`, tests pass.
- [x] Offline adapter's `spawn()` yields deterministic 4-event sequence ending in `completed`.
- [x] `agents-service.ts` round-trips through SQLite (insert → end → read parses through `AgentSchema`).
- [x] FK violation throws on unknown `adventurerId` and unknown `questId` (tested).
- [x] No `console.log`, no `child_process` import, no `@anthropic-ai/sdk` import in this task's code.
- [x] `agents` indexes migration added (idempotent, runs through migrator).
- [x] Server + shared tests pass.

## Informational Notes (not bugs)

These are observations for downstream tasks (especially `cartagena`, which implements the real Claude Code adapter). The current implementation matches the spec — these are design considerations, not violations.

1. **`createOfflineHandle()` returns the same async iterator on every `events()` call.** `const iter = generateEvents(); events() { return iter; }`. Iterating twice on the same handle yields nothing the second time (async generators are single-shot). The spec defines `events(): AsyncIterable<AgentEvent>` — single-iteration semantics are typical, so this is fine for the demo path. `cartagena` should document the same single-iteration contract or make it multi-shot.

2. **`awaitExit()` only resolves once the event iterator is fully drained.** `resolveExit({ exitCode: 0 })` is called at the end of `generateEvents()`. If a consumer calls `awaitExit()` without ever iterating `events()`, the promise will hang. The spec's acceptance criteria explicitly say "drain the event iterable, assert event ordering and that `awaitExit()` resolves" — so this matches spec. `cartagena` should consider whether a real subprocess adapter needs `awaitExit()` to be independent of event consumption (it usually does).

3. **`cancel()` resolves `exitPromise` but does not stop the event generator.** It also has no test. The spec defines `cancel(reason?: string): Promise<void>` but doesn't mandate behavior beyond the signature. The offline adapter's `cancel()` is essentially a no-op except for flipping the exit code to `null`. `cartagena`'s real adapter will need to actually kill the subprocess and stop the event stream.

4. **`getQuestAdapter()` throws synchronously when `CODE_QUESTS_USE_REAL_AGENT=1` and a `claude` binary is found.** The spec says "export a placeholder that throws so cartagena is the only place that lights it up." The current implementation throws from `createClaudeCodeAdapter()` itself, so `getQuestAdapter()` never returns an adapter object in that branch — it throws. Either interpretation (return-an-adapter-whose-methods-throw vs. throw-on-construction) satisfies the spec phrase "throws." If `cartagena` prefers an object-form placeholder, this can be refactored then.

5. **`endAgent(db, agentId, exitCode)` on an unknown `agentId` silently no-ops the UPDATE, then the subsequent `SELECT` returns `undefined`, and `rowToAgent(undefined)` throws a Zod parse error.** Not covered by tests. The spec doesn't require defensive handling here, but a future task might prefer an explicit "agent not found" error.

6. **Timestamp validity test is weak:** `expect(() => new Date(event.timestamp)).not.toThrow()` will pass for invalid strings too (e.g., `new Date('not-a-date')` returns an `Invalid Date` without throwing). The events emitted are real ISO strings via `.toISOString()`, so the test passes, but it would not catch a regression where `timestamp` becomes a non-ISO string. A stronger check would be `expect(!isNaN(new Date(event.timestamp).getTime())).toBe(true)`.

7. **`agents-service.ts` uses `row.ended_at ?? null` / `row.pid ?? null` / `row.exit_code ?? null`** where the row types are already `string | null` / `number | null`. The `?? null` is a no-op stylistically — minor.

8. **`findAgentByQuest` uses `ORDER BY started_at DESC LIMIT 1`.** If two agents share the same `started_at` (rare in practice, but possible with `datetime('now')` granularity = seconds), the ordering is undefined. A secondary sort by `id` would make it deterministic. Not required by spec.

9. **Test file location inconsistency:** `agents-service.test.ts` lives under `src/__tests__/`, while `offline-adapter-spawn.test.ts` lives under `src/agents/__tests__/`. Both conventions appear elsewhere in the repo — keeping consistency is a nice-to-have, not a bug.

## Final Verdict

**PASS** — 0 bugs filed. All acceptance criteria met. All tests, lint, typecheck, and build pass. Notes above are forwarded to `cartagena` for the real Claude Code adapter implementation.
