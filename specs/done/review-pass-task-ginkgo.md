# Review Pass — Task ginkgo (Phase 9 capstone)

**Branch:** `feature/ginkgo`
**Parent:** `feature/elder`
**Verdict:** FAIL — 4 bugs filed (0 CRITICAL, 3 HIGH, 1 LOW)

## Scope reviewed

Capstone task wiring the Phase 9 failure loop end-to-end:

- `packages/client/src/features/town-square.tsx` — new `ReturnedQuestsBadge` wired to `/hall-of-returns/quests` with per-active-quest WebSocket subscriptions
- `packages/client/src/features/guild/scar-list.tsx` — new collapsible scar badge component
- `packages/client/src/features/guild/roster.tsx` — extended to mount `ScarList`
- `packages/server/src/lib/quest-failure-detector.ts` + tests — bridges quest-runner failed status into `returnQuestToTown`
- `packages/server/src/services/quest-runner.ts` — calls the detector after marking a quest failed (both happy-path failure and error-recovery)
- `packages/server/src/__tests__/quest-runner.test.ts` — regression test updated to expect `returned_to_town`
- `packages/server/src/scripts/seed-dev-phase9.ts` + `package.json` script — `pnpm seed:phase9`
- `packages/client/tests/e2e/phase-9-capstone.spec.ts` — new Playwright walkthrough with axe-core scans
- `README.md`, `assets/CREDITS.md`, `progress.md`

## Checks performed

- ✅ Diff read in full (pre-computed, lockfiles excluded).
- ✅ `pnpm --filter @code-quests/server typecheck` — green.
- ✅ `pnpm --filter @code-quests/client typecheck` — green (`src` only; e2e excluded by tsconfig).
- ✅ `pnpm --filter @code-quests/server lint` — green.
- ✅ `pnpm --filter @code-quests/client lint` — green.
- ✅ `pnpm --filter @code-quests/server test` — 476 tests pass.
- ✅ `pnpm --filter @code-quests/client test` — 918 tests pass.
- ✅ Secret scan (`sk-`, `AKIA`, `api_key`, `password=`) — no hits in changed files.
- ✅ `console.log` scan in production source — none introduced (server uses `process.stderr.write` / `process.stdout.write`; client uses no debug logging).
- ✅ Cross-boundary: `ScarRecord` shape used by `scar-list.tsx` matches the shared schema (`questId`, `failureSummary`, `monsterIdAtFatal`, `occurredAt`).
- ✅ Quest-failure detector wiring: `quest-runner.ts:342` (success path) and `:363` (error path) both call `detectAndHandleFailure(quest.id, db, channel)` after the conditional UPDATE — only invoked when `result.changes > 0`, so no double-transition.
- ✅ Failure detector idempotency: detector reads status first and returns early if not `failed`; catches `QuestReturnError` and surfaces it via `process.stderr.write` (not silently swallowed).
- ✅ Routing: `<Route path="/hall-of-returns/:questId" ...>` exists in `app.tsx`; `ScarList`'s `navigate(/hall-of-returns/...)` lands on a real route.
- ✅ `BrowserRouter` is present in `main.tsx`, so `useNavigate` inside `ScarList` will not throw when mounted via the Town Square modal.
- ✅ Seed script guards against production (`NODE_ENV === 'production'` exit) and is idempotent (existence checks before each insert).
- ✅ Foreign-key pragma enabled in the new detector tests (`db.pragma('foreign_keys = ON')`).
- ⚠️ Capstone coverage: scar list, Hall of Returns, post-mortem, and action dialogs are reachable from Town Square via the new badge / Guild Hall. BUT the badge is visually indistinguishable from surrounding text without CSS — see review-2.

## Bugs filed

| # | Severity | Title |
|---|----------|-------|
| 1 | HIGH | Conditional assertions in Phase 9 E2E spec silently skip core flow validation |
| 2 | HIGH | New Phase 9 UI elements (scar list, returned-quests badge) have no CSS |
| 3 | HIGH | Returned-quests badge never invalidates on retire/repost/split (multi-tab spec check fails) |
| 4 | LOW | Badge count underreports when more than 20 quests are returned |

## Informational notes (not bugs)

- `ReturnedQuestsBadge` subscribes to `subscribe(questId, ...)` for every active quest just to trigger an invalidation. Each subscribe is a WebSocket listener registration. Functional, but consider using a single store-level listener per `.claude/rules/state-management.md` ("Event Listeners: Store-Level, Not Component-Level") if Phase 10 adds more event consumers.
- The detector logs `QuestReturnError` via `process.stderr.write` with a `[quest-failure-detector]` prefix — matches the existing pattern in `quest-runner.ts` and is fine. Future cleanup: lift these into a structured logger so the audit pipeline can parse them (`.claude/rules/observability-first.md`).
- `seed-dev-phase9.ts` writes a `failure_summary_json` row twice (once at INSERT, once after creating the encounters so the real `fatalEncounterId` can be substituted). Works, but a single UPDATE after the encounters would be cleaner.
- No new third-party assets per `assets/CREDITS.md` — matches the all-CSS intent (modulo the missing CSS, see review-2).
- `quest-runner` error-recovery branch has a bare `catch {}` around the failure-write fallback (line 365-367 in the diff). A comment explains the intent ("DB unavailable (e.g. shutdown in progress)"), so this is an annotated swallow — acceptable under `.claude/rules/common-findings.md` #8.

## Verdict

**FAIL — 4 bugs filed (3 HIGH, 1 LOW).** Fixer should address review-1 through review-4 before this capstone is merged. The core functionality (failure detector, scar list component, badge logic) is sound; the gaps are around test rigor, visual completeness, and cache invalidation contracts.
