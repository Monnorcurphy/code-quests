# BUG: Reconnect rehydration corrupts in-flight encounter state (cross-boundary issue)
**Severity:** HIGH
**File(s):** packages/client/src/features/quest/use-quest-stream.ts, packages/client/src/stores/encounter-store.ts

## Problem
`rehydrateEncounterOnReconnect` calls `GET /quests/:questId/encounters`, finds the encounter by ID, and dispatches a `monster_resolved` event using `resolved.outcome` from the API response.

However, the server-side schema (`packages/server/src/db/migrations/001_init.sql:87-88`) defines:
```sql
outcome TEXT NOT NULL DEFAULT 'escape'
  CHECK(outcome IN ('victory', 'defeat', 'escape')),
```
and the encounter insertion (`packages/server/src/services/monster-detection.ts:142-144`) uses that default literally:
```sql
INSERT INTO monster_encounters
  (id, monster_id, quest_id, appeared_at, combat_log_json, outcome, loot_json)
VALUES (?, ?, ?, ?, ?, 'escape', '[]')
```

The DB has no `pending` state. An encounter that is appearing-but-not-yet-resolved is stored with `outcome = 'escape'`. On WS reconnect during a live combat, the rehydration will see the in-flight encounter and dispatch `monster_resolved` with `outcome: 'escape'`, causing the client to:
- play the escape animation,
- clear the encounter from `useEncounterStore`,
- unblock scene advancement (`base-quest-scene.ts:99` checks `_combatLayer?.encounterActive`).

When the real resolution event eventually arrives over WS, the encounter is already gone from the store, so `handleAgentEvent` returns early (`if (!current) return state;`).

Net effect: a transient WebSocket disconnect during combat causes the client to falsely end the fight as an "escape," even if the real resolution would have been victory or defeat. The visible monster vanishes, the player can advance, and any rewards/penalty tied to the actual outcome are lost from the user's experience.

## Expected
Per the spec acceptance criterion: "Reconnect: if the WebSocket drops mid-combat, on reconnect the store re-hydrates from `GET /quests/:questId/encounters` so the UI matches reality."

Rehydration must distinguish "in-flight" from "actually resolved" on the receiving side. It must not synthesize a `monster_resolved` event for an encounter that the server has not actually marked as resolved.

## Fix
Pick one (server-side fix is preferred because it fixes the root cause):

**Option A (server-side, preferred):** Add a `resolved_at TIMESTAMP NULL` column (or change the default to `NULL` and make `outcome` nullable) so the API can report whether an encounter is genuinely resolved. Update `monster-detection.ts:resolveEncounter` to set the timestamp/outcome at resolution. Update `MonsterEncounterSchema` in `packages/shared/src/monster.ts` and `rowToEncounter` in `packages/server/src/routes/monsters.ts` accordingly. Then client rehydration only synthesizes `monster_resolved` if the encounter is resolved on the server.

**Option B (client-side, narrower):** In `rehydrateEncounterOnReconnect`, also fetch the WS-supplied combat-log length / quest status and only fire `monster_resolved` if we can prove resolution (e.g., the quest is `complete`/`failed`, or the encounter's `combatLog` shows a terminating event). This is fragile because it relies on inference.

Either way, add a unit test in `use-quest-stream.test.ts` (or a new file) that mocks the API returning an encounter with the default `outcome: 'escape'`, with the store currently holding the same encounter in `pending` state, and asserts the store is NOT cleared / does NOT get a synthesized resolution.
