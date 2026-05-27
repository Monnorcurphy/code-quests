# Progress — Phase 1

Previous task progress archived to metrics/progress-before-balmoral.md

## balmoral — Express API CRUD endpoints

- Restored ashford source files (deleted by metrics commit c1c8b8a) via git checkout
- Created `packages/server/src/middleware/validate.ts` — Zod body validator, field-named errors
- Created `packages/server/src/middleware/errors.ts` — structured 500 error handler
- Created `packages/server/src/routes/adventurers.ts` — full CRUD router factory
- Created `packages/server/src/routes/epics.ts` — full CRUD router factory
- Created `packages/server/src/routes/quests.ts` — full CRUD router factory with AC lock check
- Updated `packages/server/src/index.ts` — wires routes + middleware, port defaults to 4001
- Created integration tests for all three route sets (61 tests total across 5 test files)
- Added `zod` and `supertest` to server dependencies
- All tests pass, lint clean, typecheck clean
