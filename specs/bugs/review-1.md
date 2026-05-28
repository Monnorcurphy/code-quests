# BUG: Async framing race condition writes stale input_request_json after quest resumes

**Severity:** CRITICAL
**File(s):** packages/server/src/services/quest-runner.ts (lines 109-137), packages/server/src/__tests__/quest-runner.test.ts

## Problem

The async framing IIFE in `runQuest` is fire-and-forget: it does not coordinate with the rest of the event loop. When framing completes, it unconditionally writes the framed `InputRequest` back to `quests.input_request_json` and publishes a follow-up `paused_input` WebSocket event — even if the quest has already transitioned out of `paused_input` (via `resumed`, `complete`, or `failed`).

Concrete race in production (and demonstrated by the new test):

1. `paused_input` event arrives → `setInputRequest({question, context, awaitingSince})`.
2. Async framing IIFE starts (awaits `frameInputRequest` → haiku network round-trip).
3. User/agent calls `respond()`; offline adapter yields `resumed`.
4. `runQuest` handles `resumed` → `clearInputRequest()` sets `input_request_json = NULL`.
5. Quest may even progress through `combat`, `progress`, and `completed`, settling to status `complete`.
6. Framing IIFE finally resolves → `setInputRequest(updatedRequest)` overwrites NULL with stale framed data, and `publishEvent(paused_input with framing)` fires AFTER `resumed`/`complete`.

Resulting bugs:
- `quests.input_request_json` is non-null on a quest with status `complete` (or `active`-after-resume), violating the state machine. Any consumer of `getInputRequest()` or the quests API will see phantom "awaiting input" state.
- WebSocket consumers receive a `paused_input` event after `resumed`/`status_change` — UI state machines that track pause/resume status (parchment modal) will incorrectly re-show the modal after the agent already moved on.
- The follow-up framing event is NOT added to `collectedEvents`, so `agents.events_json` does not contain it — DB-event-log and WebSocket-event-stream diverge.

The test `runQuest adventure framing integration > publishes a follow-up paused_input event with adventureFraming after framing completes` actually asserts the stale state as correct: `expect(capturedDbJson).not.toBeNull()` is read after `respond()` was called and after the offline adapter has already yielded `resumed` (which cleared the row). The IIFE's later `setInputRequest` overwrites the cleared row — the test passes only because it codifies the buggy behavior.

## Expected

- Framing must not corrupt persisted state after the quest leaves `paused_input`.
- WebSocket consumers must not receive a `paused_input` event after `resumed`/`status_change`.
- The events list in `agents.events_json` should reflect the events the consumer received.
- Per `rules/state-management.md` and `rules/database-conventions.md`: state writes must respect the current status of the entity.

## Fix

In `packages/server/src/services/quest-runner.ts`, before the framing IIFE's `setInputRequest`/`publishEvent`, gate on current quest state:

1. Re-read the quest status (or the `input_request_json`) inside the IIFE after `frameInputRequest` resolves. If status is no longer `paused_input` (or the row no longer matches `awaitingSince`), discard the framing result — do not write to the DB and do not publish the follow-up event.
2. Push the follow-up `paused_input` framing event into `collectedEvents` and call `persistEvents()` so `agents.events_json` stays consistent with what the WebSocket consumer saw.
3. Surface DB / publish errors (currently swallowed by the empty `catch`) via `process.stderr.write(...)` to match the rest of the file's error-logging convention.

Update both new integration tests in `packages/server/src/__tests__/quest-runner.test.ts`:
- The "follow-up paused_input event" test should respond *only after* the framing event has arrived, OR should assert that when the agent responds first, the DB row is cleared (and no spurious `paused_input` event is delivered after `resumed`).
- Add a dedicated regression test: simulate the race by calling `respond()` immediately, and assert that after the quest completes, `quests.input_request_json IS NULL` and no `paused_input` event was published after `resumed`.
