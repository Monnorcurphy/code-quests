# BUG: REST hydrate path does not populate inputRequest / userBlocker / status in quest store

**Severity:** HIGH
**File(s):** `packages/client/src/features/quest/use-quest-stream.ts`, `packages/client/src/routes/quest.tsx`

## Problem

The extratropical-cyclone spec (step 1) requires:

> On any quest update that includes these fields (from REST hydrate or WebSocket), update store.

And acceptance criterion #2 explicitly says:

> WebSocket events drive the store transitions; manual REST refetch agrees with WebSocket state.

The current implementation only updates `inputRequestByQuest` / `userBlockerByQuest` / `statusByQuest` from WebSocket events. The `useQuery({ queryKey: ['quest', questId], queryFn: () => api.quests.get(questId!) })` call in `routes/quest.tsx:60-64` returns the full `Quest` object (which includes `inputRequest`, `userBlocker`, `status`, `currentScene`) but the result is only handed to `HUDOverlay` as a prop — it is never pushed into the Zustand store.

Concrete user-facing consequence: when a user navigates to `/quest/:questId` for a quest that is already in `paused_input` or `user_blocked` state on the server:
1. `statusByQuest[questId]` is `undefined` until the first WebSocket `status_change` arrives.
2. `BaseQuestScene._applyFreezeState` reads that undefined value and treats the scene as "not frozen" — **the scene does NOT freeze on initial load even though the server says the quest is paused**.
3. `inputRequestByQuest[questId]` / `userBlockerByQuest[questId]` are empty, so the (future) modal cannot render the pending question or blocker description from a cold load.

The only REST-driven write path is the special-case `status_change` → `user_blocked` branch inside `use-quest-stream.ts:108-116`, which re-fetches just to populate `userBlocker`. This does not cover the initial page-load case, and it does not cover `paused_input` at all.

## Expected

The spec requires REST-hydrated quest data to sync into the store. After loading the quest via `useQuery`, the store must reflect:
- `statusByQuest[questId] = quest.status`
- `inputRequestByQuest[questId] = quest.inputRequest` (or null clear)
- `userBlockerByQuest[questId] = quest.userBlocker` (or null clear)

After this, the scene's initial freeze check (`base-quest-scene.ts:117-120`) will see the correct status and freeze immediately on mount when the quest is already paused/blocked.

## Fix

In `routes/quest.tsx` (or a sibling hook), add a `useEffect` that runs whenever `quest` changes from the `useQuery` result and writes the four hydrated fields into the store. Sketch:

```typescript
useEffect(() => {
  if (!quest || !questId) return;
  const store = useQuestStore.getState();
  store.setStatus(questId, quest.status);
  if (quest.inputRequest) {
    store.setInputRequest(questId, quest.inputRequest);
  } else {
    store.clearInputRequest(questId);
  }
  if (quest.userBlocker) {
    store.setUserBlocker(questId, quest.userBlocker);
  } else {
    store.clearUserBlocker(questId);
  }
}, [quest, questId]);
```

Add a test in `__tests__/quest-route.test.tsx` (or equivalent) that mounts the route with a mocked `api.quests.get` returning `status: 'paused_input'` and verifies the store is populated before any WebSocket event fires.
