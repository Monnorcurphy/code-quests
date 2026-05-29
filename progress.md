# Progress — Phase 10

Previous task progress archived to metrics/progress-before-amur.md

## task-amur: Skills REST API — forge / confirm / dismiss / retire

**Status:** DONE

- Created `packages/shared/src/skill-actions.ts` with `ForgeSkillSchema` and `ConfirmCandidateSchema`
- Re-exported new schemas and types from `packages/shared/src/index.ts`
- Replaced `packages/server/src/routes/skills.ts` with full REST router:
  - `GET /skills` with optional `?status=` filter (validated via Zod)
  - `GET /skills/:id` with 404 on missing
  - `POST /skills` — forge; validates body via `ForgeSkillSchema`, checks monster type IDs exist
  - `POST /skills/:id/confirm` — flip candidate→active, optional name/implementation override
  - `POST /skills/:id/dismiss` — hard-delete candidate (204)
  - `POST /skills/:id/retire` — flip active→retired
- Created `packages/server/src/routes/__tests__/skills.test.ts` with full happy+400+404 coverage (all 506 server tests pass)
- Extended `packages/client/src/lib/api.ts` with `api.skills` namespace and `postEmpty` helper
- All typechecks, lints, and tests pass (506 server, 918 client)
