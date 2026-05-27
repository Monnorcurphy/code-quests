# Progress — Phase 5

Previous task progress archived to metrics/progress-before-catapult.md

## catapult — Server-side scene progression + `scene_change` event ✅

**Deliverables:**
- `packages/server/src/db/migrations/005_quest_current_scene.sql` — ALTER TABLE adds `current_scene TEXT NOT NULL DEFAULT 'quest-forest' CHECK (...)` to quests
- `packages/shared/src/quest.ts` — added `QuestSceneKeySchema` z.enum + `currentScene` field on `QuestSchema`
- `packages/shared/src/agent.ts` — added `scene_change` variant to `AgentEventSchema` discriminated union
- `packages/shared/src/index.ts` — exported `QuestSceneKeySchema` and `QuestSceneKey`
- `packages/server/src/services/quest-scene-progression.ts` — new module: `QUEST_SCENE_ORDER`, `nextScene`, `advanceQuestScene` (atomic WHERE clause), `getCurrentScene`
- `packages/server/src/services/quest-runner.ts` — heuristic: every 3rd progress event advances scene + emits `scene_change`; `completed` event advances all the way to boss-room
- `packages/server/src/routes/quests.ts` — added `current_scene` to `QuestRow` and `currentScene` to `rowToApi`

**Fixes also applied:**
- Client switch statements on `AgentEvent.type` now handle `scene_change` case (active-quest-panel.tsx, returned-quest-detail.tsx)
- All test `makeQuest` helpers updated with `currentScene: 'quest-forest'` (server + client)

**Tests:** 17 new tests in `quest-scene-progression.test.ts` + `quest-runner.test.ts`. All 221 server + 360 client tests pass.
**Typecheck:** Passes on all packages.
**Lint:** Passes on all packages.
