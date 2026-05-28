# BUG: Double-fetch of quest on status_change → user_blocked

**Severity:** LOW
**File(s):** `packages/client/src/features/quest/use-quest-stream.ts`

## Problem

In `use-quest-stream.ts:108-116`, when a WebSocket `status_change` event arrives with `to === 'user_blocked'`, the handler does two redundant things:

```typescript
void queryClientRef.current.invalidateQueries({ queryKey: ['quest', questId] });
void api.quests.get(questId).then((quest) => {
  if (quest.userBlocker) {
    useQuestStore.getState().setUserBlocker(questId, quest.userBlocker);
  }
}).catch(() => { /* swallow */ });
```

`invalidateQueries(['quest', questId])` causes the active `useQuery` in `routes/quest.tsx` to refetch the quest. The explicit `api.quests.get(questId)` call then issues a **second, independent HTTP request** for the same quest — both round-trip the server for the same record.

Additionally, the `.catch(() => {})` swallows any error silently — common-findings rule #8 says every catch must surface the error or have an explicit `// intentionally swallowed: <reason>` comment. The inline comment "Best-effort — silently ignore API errors during user_blocked hydration" is present but worth keeping next to ALL error-swallowing sites (the analogous `.catch` in `rehydrateEncounterOnReconnect` does have an explanatory comment, so this matches the file's existing style — primary issue is the duplicate fetch).

## Expected

A single fetch path. Either:
- Rely on `invalidateQueries` + a REST-hydrate effect (see bug review-1) to update the store, OR
- Skip the invalidation and let the explicit `api.quests.get` write to the store.

Doing both wastes a network round-trip per `user_blocked` transition and creates a race (which response wins the React Query cache vs. the store update?).

## Fix

If bug review-1 is fixed (REST hydrate writes to store), drop the explicit `api.quests.get(...)` block entirely — `invalidateQueries` triggers `useQuery` refetch, which the hydrate effect propagates into the store. The handler simplifies to:

```typescript
if (event.to === 'user_blocked') {
  void queryClientRef.current.invalidateQueries({ queryKey: ['quest', questId] });
}
```

If review-1 is not addressed in the same fix pass, keep the explicit fetch but remove the redundant `invalidateQueries` for this event (the explicit fetch is what populates the store).
