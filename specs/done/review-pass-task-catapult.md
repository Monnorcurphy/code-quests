# Review Pass — Task catapult

**Branch:** feature/catapult
**Parent branch:** feature/arquebus
**Scope:** Server-side scene progression + `scene_change` AgentEvent

## Checks performed

- Read task spec at `metrics/task-catapult-context.md`.
- Read the pre-computed diff (24 files, +501/-15) end-to-end.
- Read modified/new files in full:
  - `packages/server/src/services/quest-scene-progression.ts`
  - `packages/server/src/services/quest-runner.ts`
  - `packages/server/src/db/migrations/005_quest_current_scene.sql`
  - `packages/server/src/routes/quests.ts`
  - `packages/shared/src/quest.ts`, `packages/shared/src/agent.ts`, `packages/shared/src/index.ts`
  - `packages/client/src/features/quests/active-quest-panel.tsx`
  - `packages/client/src/features/quests/returned-quest-detail.tsx`
  - `packages/client/src/features/quests/use-active-quest.ts`
  - `packages/server/src/services/__tests__/quest-scene-progression.test.ts`
  - `packages/server/src/__tests__/quest-runner.test.ts`
- Verified cross-boundary parity by comparing the four enums byte-for-byte:
  - SQL CHECK in `005_quest_current_scene.sql`
  - `QuestSceneKeySchema` in `packages/shared/src/quest.ts`
  - `QUEST_SCENE_ORDER` in `packages/server/src/services/quest-scene-progression.ts`
  - `QUEST_SCENE_KEYS` in `packages/client/src/game/scene-registry.ts`
  → all 4 identical: `['quest-forest','quest-cave','quest-dungeon','quest-boss-room']`.
- Ran `pnpm -r test` — 360 client + all server tests pass.
- Ran `pnpm -r typecheck` — clean.
- Ran `pnpm -r lint` — clean.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) — none.
- Reviewed for `console.log`, debug prints, commented-out code — none introduced.
- Verified migration number sequence (`001`–`005`, no gaps/overlaps).
- Verified `runMigrations` idempotency (rerun via `schema_migrations` table key).
- Confirmed `advanceQuestScene` uses optimistic `WHERE id = ? AND current_scene = ?`
  for concurrency safety (test on line 101 covers the second-call case).
- Confirmed CHECK constraint enforcement test (`rejects invalid current_scene values`).

## Bugs filed

- **review-1** (HIGH): scene_change events emitted to WebSocket are not added
  to `collectedEvents`, so they never appear in the persisted
  `agents.events_json`. The historical Hall of Returns view will silently lose
  every scene transition even though `returned-quest-detail.tsx` was updated
  to format them.

## INFORMATIONAL notes

- **Client `QUEST_SCENE_KEYS` is duplicated**, not imported from
  `@code-quests/shared`. The two arrays happen to match today but there is no
  compile-time or runtime test enforcing parity between the client array and
  the shared Zod enum. The server-side `QUEST_SCENE_ORDER` *does* have a parity
  test against `QuestSceneKeySchema.options` (good). Consider either importing
  the array from `@code-quests/shared`, or adding a similar parity test in the
  client package. Pre-existing pattern — not introduced by this task.
- **Event ordering on completion**: when `completed` arrives, `publishEvent` is
  called for the `completed` event *before* the scene_change loop runs. From a
  WebSocket subscriber's perspective the order is `completed`, then one or more
  `scene_change`s ending at `quest-boss-room`. This is fine for the active
  panel feed (chronological list) but is mildly counter-intuitive — a future
  cinematic might prefer scene_change → completed order. Not a bug today.
- **`current_scene` mutation under failure race**: if `completed` arrives after
  a cancel has flipped status to `'failed'`, `transitionQuestStatus` throws
  `InvalidTransitionError` (caught), but the scene-advancement loop earlier in
  the branch already pushed `current_scene` to `'quest-boss-room'`. A failed
  quest can therefore end up with `current_scene = 'quest-boss-room'`. No UI
  currently reads `current_scene` for non-active quests, so no visible impact
  today. Worth tracking if the field starts being shown on failed quests.
- **Route response not test-covered**: `rowToApi` now returns `currentScene`,
  but `quest-lifecycle.test.ts` (the HTTP route tests) does not assert on it.
  Future task could add a single assertion to `/quests/active` and `/quests/:id`
  to lock this in.
- **CHECK-vs-Zod constants drift**: the SQL CHECK constraint hard-codes the
  scene list. If anyone adds a 5th scene to `QuestSceneKeySchema`, the DB will
  silently reject inserts — but a new migration would be required anyway, so
  this is acceptable.

## Verdict

**FAIL — 1 HIGH bug filed (review-1).**

All factory rules satisfied except the persistence inconsistency captured in
review-1. Tests, typecheck, and lint pass; cross-boundary parity for the new
enum is intact across SQL, Zod, server const, and client const.
