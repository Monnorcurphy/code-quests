# Progress — Phase 4

Previous task progress archived to metrics/progress-before-cartagena.md

## Task cartagena — Claude Code subprocess adapter

**Status:** Complete

**What was built:**
- `packages/server/src/agents/cc-adapter.ts` — implements `AgentAdapter.spawn()` against the Claude Code binary. Includes `MissingBinaryError`, `findBinPath()`, async stream-json parser, `AsyncQueue<T>` iterable, FAILURE_PATTERNS (goblin_linter / imp_typecheck / ogre_failing_test), temp `.mcp.json` wiring, SIGTERM/SIGKILL cancel with 5s grace, cleanup on all exit paths.
- `packages/server/src/agents/adapter.ts` — added `adventurerClass?` and `mcpServers?` to `AgentSpawnInput`.
- `packages/server/src/agents/select-adapter.ts` — wired `createCcAdapter()` and `findBinPath()` from cc-adapter; removed old placeholder.
- `packages/server/src/agents/__tests__/cc-adapter.test.ts` — 3 tests: success path + cleanup, non-zero exit → failed, cancel() closes stream + cleanup.
- `packages/server/src/agents/__tests__/cc-adapter-missing-binary.test.ts` — 2 tests: MissingBinaryError thrown when binary not found.

**Verify:** 145 server tests pass, 0 typecheck errors, 0 lint errors. All packages green (480 total tests passing).
