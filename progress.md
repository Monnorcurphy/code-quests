# Progress — Phase 7

Previous task progress archived to metrics/progress-before-cloudburst.md

## Task: cloudburst — Agent adapter pause/resume contract

**Status:** Complete

**What was built:**
- `packages/server/src/agents/adapter.ts` — Added `respond(text: string): Promise<void>` to the `AgentHandle` interface
- `packages/server/src/agents/offline-adapter.ts` — Rewrote to include scripted pause/resume flow: emits `paused_input` after first progress event, blocks until `respond()` is called, then emits `resumed` and continues. Exported `OFFLINE_PAUSE_QUESTION` constant. `cancel()` safely resolves the pause during shutdown.
- `packages/server/src/agents/cc-adapter.ts` — Added `PAUSED_INPUT_MARKER` regex (`[[PAUSED_INPUT question="..." context="..."]]`), marker detection in stdout handler and close handler, `respond()` method that writes to stdin and emits `resumed` event. stdin kept open for the respond() protocol.
- `packages/server/src/services/quest-runner.ts` — Imported `setInputRequest`/`clearInputRequest` from quest-repository; added handlers for `paused_input` (transition to paused_input status, set input_request_json, publish status_change + event, persist events) and `resumed` (transition back to active, clear input_request_json, publish).
- New test: `offline-adapter-pause-resume.test.ts` — 4 tests covering full pause/resume cycle, cancel during pause, events after resumed.
- Updated: `offline-adapter-spawn.test.ts` — Updated 5 tests to use `drainWithRespond` helper that calls `respond()` when paused_input is received.
- Updated: `cc-adapter.test.ts` — Added 2 marker detection tests (with and without context field).
- Updated: `quest-runner.test.ts` — Updated 3 existing offline-adapter tests to auto-respond during pause; added 3 new paused_input/resumed integration tests.

**Tests:** 324 passed (0 failed). TypeScript strict: clean. ESLint: clean.
