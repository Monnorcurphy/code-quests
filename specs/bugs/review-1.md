# BUG: failure_summary_json written before guarded transition succeeds

**Severity:** HIGH
**File(s):**
- `packages/server/src/services/quest-runner.ts` (lines 77–92, the `event.type === 'failed'` branch)
- `packages/server/src/routes/quests.ts` (`/fail` lines 438–446, `/cancel` lines 474–482)

## Problem

All three failure paths write `failure_summary_json` to the database BEFORE calling `transitionQuestStatus`. When the guarded `UPDATE quests SET status = ? WHERE id = ? AND status = ?` matches 0 rows (because the quest has already moved out of `'active'` via a competing path), `InvalidTransitionError` is thrown but the failure summary is already in the database, attached to a quest in some other status.

Concrete races possible with the new endpoints:

1. **`/cancel` wins, runQuest's `failed` event arrives second.** `/cancel` already set `recommendation = 'retire'` and transitioned `active → failed`. The async loop in `quest-runner.ts` then writes `recommendation = 'repost_with_clarification'` over the top, swallows the `InvalidTransitionError`, and calls `endAgent(..., 1)` — overwriting the `null` exit code that `/cancel` stored. The persisted record now claims the user wanted to repost.

2. **`/complete` wins, runQuest's `failed` event arrives second.** Quest is now `'complete'` but `failure_summary_json` is populated with a `repost_with_clarification` recommendation — a state that should be impossible (complete quests have no failure summary).

3. **`/fail` / `/cancel` raced by runQuest.** Same shape — the failure_summary write succeeds even though the transition will throw.

Also: when `transitionQuestStatus` throws in `/fail` and `/cancel`, the route surfaces 409 to the client, but the database has already been mutated. Caller sees "couldn't fail/cancel" but the row is partially updated.

## Expected

State changes guarded by `transitionQuestStatus` must be atomic with the writes that depend on them. Either:
- Combine the status flip and the failure-summary write into a single `UPDATE ... WHERE id = ? AND status = ?` statement, OR
- Wrap both writes in a `db.transaction(...)` that aborts when the guarded UPDATE changes 0 rows.

Per `database-conventions.md` + the constitution's "constrain inputs, don't validate outputs" — the receiving system (the DB row) must never end up in an inconsistent shape.

## Fix

In `packages/server/src/services/quest-runner.ts` failed branch (≈lines 77–92), reorder so the failure summary is only persisted on a successful transition. Suggested shape:

```ts
if (event.type === 'failed') {
  const failureSummary = {
    reason: event.reason ?? '',
    recommendation: 'repost_with_clarification' as const,
  };
  const ts = new Date().toISOString();
  const result = db
    .prepare(
      "UPDATE quests SET status = 'failed', failure_summary_json = ?, updated_at = ? WHERE id = ? AND status = 'active'",
    )
    .run(JSON.stringify(failureSummary), ts, quest.id);
  if ((result as { changes: number }).changes > 0) {
    endAgent(db, agent.id, 1);
  }
  return;
}
```

Apply the same combined-UPDATE pattern in `routes/quests.ts`:
- `/fail` (lines 438–446): write `status`, `failure_summary_json`, and `updated_at` in one guarded UPDATE; only call `endAgent` if `changes > 0`. Return 409 otherwise and do not mutate.
- `/cancel` (lines 474–482): same shape, with the `'retire'` recommendation.

Add a regression test that exercises the race: dispatch a quest, immediately call `/cancel` while the runner is still emitting events, and assert the final row has `recommendation === 'retire'` (not `'repost_with_clarification'`) and `exit_code === null` (not `1`).
