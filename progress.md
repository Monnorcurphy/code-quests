# Progress — Phase 3

Previous task progress archived to metrics/progress-before-citrine.md

## citrine — Skills / Tools / MCP servers read API + seed catalog

**Status:** Done

**What was built:**
- Extended `packages/shared/src/equipment.ts` with `SkillSchema`, `ToolSchema`, `MCPServerSchema` (+ `SkillStatusSchema`, `SkillCreatedBySchema`) and inferred types
- Re-exported all new schemas and types from `packages/shared/src/index.ts`
- Created read-only GET routers: `packages/server/src/routes/skills.ts`, `tools.ts`, `mcp-servers.ts`
- Mounted all three routers in `packages/server/src/index.ts` at `/skills`, `/tools`, `/mcp-servers`
- Added idempotent seed migration `packages/server/src/db/migrations/002_seed_equipment.sql` (4 skills, 4 tools, 2 MCP servers with INSERT OR IGNORE)
- Added integration tests in `packages/server/src/__tests__/equipment-catalog.test.ts` (14 tests — all 3 endpoints, schema validation, idempotency, seed content)

**All tests green:** 101 server tests, 58 shared tests, 206 client tests. Lint and typecheck clean.
