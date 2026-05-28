# BUG: Missing tests for quest-runner pending-encounter resolution logic
**Severity:** LOW
**File(s):** packages/server/src/__tests__/quest-runner.test.ts, packages/server/src/services/quest-runner.ts

## Problem
The task acceptance criteria require the following behavior in `quest-runner.ts`:
- On `combat` event: classify → record encounter → publish `monster_appeared` BEFORE the `combat` event
- On `completed` event: resolve all pending encounters as `victory`
- On `failed` event: resolve the LAST pending encounter as `defeat` and the rest as `escape`
- Publish `monster_resolved` for each resolution
- Clear `pendingEncountersByQuest` per quest after resolution

This logic is non-trivial (pendingEncountersByQuest map, index-based ordering, event ordering) and lives in `quest-runner.ts` lines 73-186. There are **no tests** covering any of it in `packages/server/src/__tests__/quest-runner.test.ts`. The existing tests in that file (scene progression, error recovery) do not exercise the combat/encounter integration at all.

The four functions in `monster-detection.ts` are well-tested, but the integration path (combat event → publish `monster_appeared` before `combat`, then `monster_resolved` on completed/failed with correct outcome mapping) is verified only by manual inspection.

## Expected
Per `rules/testing.md`: "Unit tests for every command handler, API endpoint, or public function". The new `combat`/`completed`/`failed` branches in `runQuest` constitute new behavior that must be covered.

Per the task acceptance criteria, the following must be testable:
1. `combat` event triggers `monster_appeared` published BEFORE the `combat` event
2. `completed` event resolves all pending encounters as `victory`
3. `failed` event resolves the last pending encounter as `defeat` and the rest as `escape`
4. `monster_resolved` events are published with the correct outcome
5. `pendingEncountersByQuest` is cleared after resolution

## Fix
Add tests to `packages/server/src/__tests__/quest-runner.test.ts` using `vi.mocked(getQuestAdapter).mockReturnValueOnce({...})` (matching the existing pattern) with an async generator that yields a sequence like:
- `progress`, `combat (msg='lint error')`, `combat (msg='typescript error')`, `completed` → assert two `monster_appeared` events published BEFORE their `combat` events, and two `monster_resolved` events with outcome `victory` after `completed`
- `progress`, `combat`, `combat`, `failed` → assert two `monster_resolved` events: the first with outcome `escape`, the last with outcome `defeat`
- Verify `monsters.encounters` and `monster_encounters.outcome` rows in the DB after each scenario
