# BUG: Reconnect rehydration ignores encounters the client doesn't already know about
**Severity:** HIGH
**File(s):** packages/client/src/features/quest/use-quest-stream.ts

## Problem
`rehydrateEncounterOnReconnect` is gated on the client already having a `pending` encounter in `useEncounterStore`:

```ts
const storeEncounter = useEncounterStore.getState().byQuest[questId];
if (storeEncounter?.outcome === 'pending') {
  const resolved = encounters.find((e) => e.id === storeEncounter.encounterId);
  ...
}
```

If the client has no encounter in the store (for example: page was refreshed, browser tab reopened, navigated Town → Quest after a disconnect, or the `monster_appeared` event arrived while the socket was already down), this branch is skipped entirely. No spawn occurs and no encounter HUD is shown — even though the server has an active or recently-resolved encounter for this quest.

The acceptance criterion is unambiguous: "on reconnect the store re-hydrates from `GET /quests/:questId/encounters` so the UI matches reality." Today the UI does not match reality in any case other than "client knows about a pending encounter."

Additionally, on every reconnect the endpoint is queried but most of its payload is discarded; there is no UI affordance to surface historical encounters either.

## Expected
After a (re)connect, the client's encounter state should reflect the server's view of what is currently active for the quest. Concretely:
- If the server has a most-recent encounter that is still active and the client has none, spawn it on the client by synthesizing a `monster_appeared` event (or by writing it directly into the store).
- If the server has a most-recent encounter that is resolved and the client has none, do nothing (the resolution already happened — the client can stay in "no encounter" state).
- Only fire `monster_resolved` when we can prove the server has resolved the encounter (see also `review-2.md`).

## Fix
1. Rewrite `rehydrateEncounterOnReconnect(questId)` to take the *latest* encounter from the server (`encounters[encounters.length - 1]` since `ENCOUNTER_BY_QUEST_SQL` orders by `appeared_at ASC`) and reconcile it against `useEncounterStore.getState().byQuest[questId]`:
   - If the server's latest encounter is unresolved and the store has nothing (or a different encounter id) → synthesize a `monster_appeared` event and dispatch it via `useEncounterStore.getState().handleAgentEvent`.
   - If the server's latest encounter is resolved and the store has the same id pending → dispatch `monster_resolved` (but see `review-2.md` for the "resolved vs default" distinction).
   - Otherwise → no-op.
2. The `monster_appeared` synthesis needs `monsterTypeId`, `monsterName`, `spritePath`, and `difficulty`. Today `GET /quests/:questId/encounters` does not return these (it returns only the encounter row). Extend the API response, or add a second call (`GET /monsters/:id`) to enrich. Update `MonsterEncounterSchema` if needed.
3. Add tests in `use-quest-stream.test.ts` covering:
   - Reconnect when client has no encounter and server has an unresolved one → store now has the encounter.
   - Reconnect when client and server agree (both empty / both same resolved id) → no spurious dispatches.
   - Reconnect when client has a pending encounter and server has it resolved → dispatch `monster_resolved` with the real outcome (combined with the fix from `review-2.md`).
