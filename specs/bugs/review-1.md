# BUG: `resumed` event is not persisted to the agent's collected_events JSON

**Severity:** HIGH
**File(s):** `packages/server/src/services/quest-runner.ts`

## Problem

In `quest-runner.ts` lines 110-128, the `resumed` event branch:

```ts
if (event.type === 'resumed') {
  try {
    transitionQuestStatus(db, quest.id, 'paused_input', 'active');
    // ... push status_change ...
  } catch (err) { ... }
  clearInputRequest(db, quest.id);
  collectedEvents.push(event);
  publishEvent?.(quest.id, event);
  continue;   // <-- persistEvents() is NOT called
}
```

The `paused_input` branch above calls `persistEvents()` before `continue`, but the `resumed` branch does not. The `resumed` event (and the synthetic `status_change`) only get written to `agents.events_json` later, when a `completed` or `failed` event arrives — or never, if the process crashes between resume and completion.

## Expected

The task spec (metrics/task-cloudburst-context.md, Step 4) explicitly requires:

> Persist `paused_input` **and** `resumed` to the agent's collected_events JSON so reloads are consistent.

A crash or shutdown after resume but before completion leaves stale event history in the DB — the persisted events end at `paused_input`, even though `quests.status` has already transitioned back to `'active'` and `quests.input_request_json` has been cleared. On reload, the event stream and the quest state are inconsistent.

## Fix

Call `persistEvents()` inside the `resumed` branch, mirroring the pattern used for `paused_input`:

```ts
if (event.type === 'resumed') {
  try {
    transitionQuestStatus(db, quest.id, 'paused_input', 'active');
    // ...
  } catch (err) { ... }
  clearInputRequest(db, quest.id);
  collectedEvents.push(event);
  publishEvent?.(quest.id, event);
  persistEvents();   // ADD THIS LINE
  continue;
}
```

Add a regression test that confirms `agents.events_json` contains the `resumed` event immediately after a `paused_input` → `respond()` cycle, without waiting for `completed`.
