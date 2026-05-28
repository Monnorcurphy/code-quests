# Review Pass — task-electrical-storm

**Branch:** feature/electrical-storm
**Reviewer:** adversarial code reviewer

## Checks performed

- Read pre-computed diff (3 files: routes/quests.ts, tests, progress.md).
- Cross-referenced spec at `metrics/task-electrical-storm-context.md`.
- Ran `pnpm --filter @code-quests/server test -- src/__tests__/quests-pause-block.test.ts`
  → 27 files, 373 tests passed. New file contributes 21 tests.
- Ran `pnpm --filter @code-quests/server lint` → clean.
- Ran `pnpm --filter @code-quests/server typecheck` → clean.
- Grepped routes file and new test file for hardcoded secrets (`sk-`, `AKIA`,
  `api_key`, `password=`) → none.
- Cross-boundary validation:
  - DB CHECK on `quests.status` (`001_init.sql:31`) lists
    `idle, active, complete, failed, paused_input, user_blocked` — all status
    values the three new routes use as `from`/`to` are inside the constraint.
  - `AgentEvent` discriminated union (`packages/shared/src/agent.ts:28-33,
    71-82`) already has `status_change`, `paused_input`, `resumed` variants.
    The new routes publish payloads that match the schema exactly.
  - `UserBlockerSchema` (`packages/shared/src/quest.ts:14-19`) requires
    `rawDescription` and `markedAt`; both are supplied. `unblockedAt` is
    optional (see bug review-1 for an edge case).
- Quest-channel review: `publishQuestEvent` is generic; no changes required
  because the new event variants are forwarded by the existing contract. The
  spec called this out and the diff correctly left the file untouched.
- Verified `validate(...)` middleware is reused for the two routes that take
  a body (`respond-input`, `block`). `unblock` has no body — consistent.
- Verified HTTP codes match spec:
  - `/respond-input`: 404, 400 (via Zod), 409, 410, 500, 200 ✓
  - `/block`: 404, 400, 409, 500, 200 ✓
  - `/unblock`: 404, 409, 500, 200 ✓
- Verified `handle.cancel('user_blocked')` is called inside `/block` when
  there is an active handle (line 676–679) and that the spec's documenting
  comment is present (lines 674–675). ✓
- Test coverage matches all acceptance criteria from the spec, including the
  410-no-handle path, the 409 mid-state path, the cancel-active-handle path,
  the status_change channel forwarding, and the full pause→respond cycle that
  drives the offline adapter to completion.

## Bugs filed

1. **review-1 (LOW)** — `/block` async framing can clobber `unblockedAt` set
   by a concurrent `/unblock`. Gate compares only `markedAt`, which is
   preserved across unblock.
2. **review-2 (LOW)** — Dead `markedAt` variable in
   `quests-pause-block.test.ts` with a `void` workaround. Violates
   code-quality "no unused variables" rule.

## INFORMATIONAL notes

- The spec text refers to routes as `/api/quests/...` but the existing
  convention throughout the codebase mounts the quests router at `/quests`
  (see `packages/server/src/index.ts:23`). The new routes correctly follow
  the existing convention, not the literal spec text. Not a bug.
- `/unblock`: if `transitionQuestStatus('user_blocked' → 'active')` throws
  after `setUserBlocker` has already added `unblockedAt`, the blocker record
  ends up with `unblockedAt` while status is still `user_blocked`. This is
  a benign metadata inconsistency in a race-only path. Could be hardened
  later by wrapping the two writes in a SQL transaction; not filing as a bug.
- `/unblock` returns 500 if the row's `user_blocker_json` is somehow NULL
  while status is `user_blocked`. That state would imply a DB integrity
  issue; the response is reasonable. Worth noting in case future migration
  work could expose this path.

## Verdict

**FAIL — 2 bug files filed (both LOW).**

Lint, typecheck, and tests all pass. The bugs are quality issues, not
correctness blockers for the happy paths covered by the spec acceptance
criteria.
