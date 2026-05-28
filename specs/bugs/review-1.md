# BUG: `completed` and `failed` outcomes are never surfaced in the HUD

**Severity:** HIGH
**File(s):**
- `packages/client/src/features/quest/use-quest-stream.ts`
- `packages/client/src/features/quest/combat-log.tsx`

## Problem

The task spec requires the WebSocket pipeline to "(d) surface `completed` / `failed` outcomes." The current implementation does not. Two compounding gaps:

1. `use-quest-stream.ts` only mirrors `scene_change` and `status_change` into the store. When a `completed` or `failed` event arrives, it is appended to `entriesByQuest` but no `setStatus(...)` call is made, so the HUD badge stays on the previous status.
2. The server runner (`packages/server/src/services/quest-runner.ts`) updates the DB row directly via `transitionQuestStatus(...)` on `completed`/`failed` but never publishes a corresponding `status_change` AgentEvent. So the client cannot rely on a `status_change` arriving alongside `completed`/`failed` either.
3. `combat-log.tsx` filters the visible log via `LOG_EVENT_TYPES = new Set(['progress', 'log', 'combat'])`. `completed` and `failed` are excluded, so the user never sees the `summary` (completed) or `reason` (failed) text in the log either.

Net effect: when an agent finishes the quest, the user sees no UI change at all — the badge still says "Active", the log shows nothing new, and the only way to learn the quest is done is to navigate away and back (or refresh) so the `useQuery(['quest', questId])` re-fetches.

## Expected

Spec acceptance criterion (d) — `completed` / `failed` outcomes must be visibly surfaced through the realtime channel:

- The status badge must reflect a completed/failed outcome the moment the realtime event arrives, without a manual refresh.
- The `summary` / `reason` carried on those events must be visible to the user (combat log entry, banner, or both).
- Tests must cover the new behavior — the existing `use-quest-stream.test.tsx` has no case for `completed` or `failed`.

## Fix

1. In `packages/client/src/features/quest/use-quest-stream.ts`, after `store.appendEvent(...)`, also call `store.setStatus(questId, 'complete')` when `event.type === 'completed'` and `store.setStatus(questId, 'failed')` when `event.type === 'failed'`.
2. In `packages/client/src/features/quest/combat-log.tsx`, either:
   - Extend `LOG_EVENT_TYPES` to include `'completed'` and `'failed'`, and extend `getMessage` (and `TYPE_LABELS`) to render `event.summary` / `event.reason`; or
   - Render a dedicated "outcome" banner in the HUD (e.g., green for completed with summary, red for failed with reason) that auto-dismisses or stays until the user returns to town.
3. Add tests in `use-quest-stream.test.tsx` for both `completed` and `failed` paths — assert that `statusByQuest[questId]` updates and the log entry / outcome surface is visible.
4. Also invalidate the `['quest', questId]` react-query cache so the persisted quest row catches up.
