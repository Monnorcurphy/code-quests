# Progress — Phase 6

Previous task progress archived to metrics/progress-before-arizona.md

## Task: arizona — Monster-detection service + encounter recorder

**Status:** Done

**Delivered:**
- `packages/server/src/services/monster-name-generator.ts` — generates names like "Grumbling Goblin" from a 15-adjective word list
- `packages/server/src/services/monster-detection.ts` — `classifyCombatEvent`, `recordEncounter`, `resolveEncounter`, `recalibrateDifficulty`
- `packages/server/src/services/__tests__/monster-detection.test.ts` — 20 tests covering all functions
- `packages/shared/src/agent.ts` — added `monster_appeared` and `monster_resolved` event types to `AgentEventSchema`
- `packages/server/src/services/quest-runner.ts` — integrated monster detection into the event loop; publishes `monster_appeared` before `combat` event; resolves encounters on `completed`/`failed`

**Verification:** 271 tests pass, typecheck clean, lint clean.
