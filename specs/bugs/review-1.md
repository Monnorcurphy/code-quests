# BUG: QuestRoute mounts wrong initial scene (always quest-forest)

**Severity:** CRITICAL
**File(s):** packages/client/src/routes/quest.tsx

## Problem

`packages/client/src/routes/quest.tsx:30-32` initializes the PhaserMount initial-scene ref while the quest data is still loading:

```ts
const mountScene = useRef<SceneKey>(
  (quest?.currentScene ?? 'quest-forest') as SceneKey,
);
```

`useRef`'s initial value is evaluated only on the FIRST render. On that first render `quest` is `undefined` (the query is still pending), so `mountScene.current` is captured as `'quest-forest'`. When the quest data eventually arrives and the route re-renders, the ref is NOT re-initialized — it still holds `'quest-forest'`. The route then renders `<PhaserMount initialScene={mountScene.current} />` with that stale value.

`PhaserMount` (`packages/client/src/game/phaser-mount.tsx:14`) further captures `initialScene` in its own one-shot useRef, so any subsequent prop change is ignored.

Net effect: every quest, regardless of `quest.currentScene` (forest / cave / dungeon / boss-room), starts in the forest scene on initial mount.

The existing test (`packages/client/src/__tests__/quest-route.test.tsx:106-111`) hides this because it only ever passes `currentScene: 'quest-forest'` — the fallback value — so it always appears to "work."

## Expected

Per the task spec (`metrics/task-cestus-context.md`):
- "render `<Suspense>` around a `PhaserMount` configured with `initialScene = quest.currentScene`"
- Acceptance: "Route loads and renders the right scene based on `currentScene`."

A user opening `/quest/<id>` for a quest at `quest-cave` must see the cave scene, not the forest.

## Fix

Pick one of:

1. Drop the ref entirely — `quest` is guaranteed defined by the time the main return runs (the loading and error branches both return early). Pass `quest.currentScene` directly:
   ```tsx
   <PhaserMount initialScene={quest.currentScene as SceneKey} />
   ```
2. Or compute the ref lazily after data arrives (e.g., set it in an effect that fires once when `quest` first becomes non-null).

Add a regression test in `quest-route.test.tsx` that asserts `data-initial-scene` is `'quest-cave'` (or `'quest-dungeon'`) when `makeQuest({ currentScene: 'quest-cave' })` is returned.
