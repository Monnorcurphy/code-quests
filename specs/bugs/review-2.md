# BUG: quest-runner event-loop errors leave the quest stuck in `active`

**Severity:** HIGH
**File(s):** `packages/server/src/services/quest-runner.ts` (lines 60–99)

## Problem

The `runQuest` async loop wraps the `for await (const event of handle.events())` body in a `try { ... } catch (err) { process.stderr.write(...) } finally { activeHandles.delete(...) }`.

If the iterator throws (network/EPIPE in the cc-adapter, JSON parse explosion, anything inside the adapter), the catch logs a message and the `finally` removes the handle from the map. The quest's row, however, remains:
- `quests.status = 'active'`
- `quests.agent_id = <agent>`
- `agents.ended_at = NULL` (never closed)
- No `failure_summary_json` recorded.

The quest is now stuck in `active` forever:
- `GET /quests/active` still returns it with an agent that no longer exists.
- `/dispatch` rejects it with 409 "Quest already dispatched."
- `/complete`, `/fail`, `/cancel` still work, but only because the user happens to know the quest is broken — there is no signal in the UI/API surface.
- The `auto-match` service in `castillo-de-san-marcos` will exclude the (phantom) adventurer because the agent row says it's still busy.

For a local-first single-user app, this is a real silent-failure path — the user has to manually `/cancel` to recover, and they don't know they need to.

This also violates `common-findings.md` rule #8 "Silent error swallowing" — the catch surfaces the error to stderr but doesn't surface it to the user or repair state.

## Expected

When the event loop fails, the runner must:
1. Transition the quest `active → failed` with a `failure_summary` that names the underlying error.
2. End the agent row with `exit_code = null` (unknown — adapter died).
3. Optionally publish a synthetic `failed` event on the WS channel so connected clients see the transition.

Per `common-findings.md` #8: "every catch block must surface the error OR have `// intentionally swallowed: <reason>`". Here the error must be surfaced as quest-level state, not just stderr.

## Fix

In `runQuest`'s catch block, before the finally:

```ts
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[quest-runner] event loop error for quest ${quest.id}: ${msg}\n`);
  const failureSummary = { reason: `Adventurer's stream broke: ${msg}`, recommendation: 'retry' as const };
  const ts = new Date().toISOString();
  const result = db
    .prepare(
      "UPDATE quests SET status = 'failed', failure_summary_json = ?, updated_at = ? WHERE id = ? AND status = 'active'",
    )
    .run(JSON.stringify(failureSummary), ts, quest.id);
  if ((result as { changes: number }).changes > 0) {
    endAgent(db, agent.id, null);
    publishEvent?.(quest.id, { type: 'failed', timestamp: ts, reason: msg });
  }
} finally {
  activeHandles.delete(quest.id);
}
```

Add a regression test: feed `runQuest` an adapter whose `events()` async iterator throws after one event; assert the quest ends up `failed` with the expected reason and the agent row is closed.
