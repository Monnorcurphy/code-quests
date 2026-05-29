# Progress — Phase 10

Previous task progress archived to metrics/progress-before-amazon.md

## Task amazon — Skill candidate detection service

**Status:** DONE

**What was built:**
- `packages/server/src/db/migrations/008_skill_candidates.sql` — adds `detected_for_adventurer_id` and `last_detection_at` columns to `skills`, plus `idx_skills_status_typeids` index.
- `packages/server/src/services/skill-candidate-detection.ts` — `evaluateSkillCandidate()` counts per-adventurer × per-monster-type victories; creates a `candidate` skill at threshold, increments `hit_count` on subsequent calls, bumps `hit_count` on existing `active`/`retired` skills instead of creating duplicates.
- Extended `resolveEncounter()` in `monster-detection.ts` to call `evaluateSkillCandidate` after a victory outcome.
- `packages/server/src/services/__tests__/skill-candidate-detection.test.ts` — 6 tests covering all specified scenarios; all 482 tests pass.

**Commit:** b694cc1
