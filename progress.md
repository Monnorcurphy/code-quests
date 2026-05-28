# Progress — Phase 8

Previous task progress archived to metrics/progress-before-capella.md

## capella — AudioController (state-driven event dispatch)

**Status:** Done

**Files created:**
- `packages/client/src/audio/audio-controller.ts` — exports `AudioController` interface, `QuestStore`/`SceneStore`/`EncounterStore` types, `AudioControllerSnapshot`, `deriveAudioEvent` (pure reducer), `BOSS_MONSTER_TYPES`, and `createAudioController`.
- `packages/client/src/audio/__tests__/audio-controller.test.ts` — 22 tests covering all contract-table rows and subscription behaviour.

**Key design decisions:**
- Any non-null encounter (regardless of outcome) keeps the combat loop playing until the encounter is explicitly cleared from the store. This allows VICTORY_STINGER and QUEST_COMPLETE to fire while COMBAT continues underneath, matching the expected play sequence: `TOWN → ROAD → COMBAT → VICTORY_STINGER → QUEST_COMPLETE → TOWN`.
- `paused_input` and `user_blocked` statuses are treated as `active` by `deriveAudioEvent`, so the road loop stays playing while paused (PAUSE_BELL fires as a one-shot on top).
- PAUSE_BELL fires only on the rising edge of the paused/blocked condition.
- Repeated start/stop cycles do not accumulate subscriptions.

**Tests:** 747 total, all pass. Typecheck and lint clean.
