# Progress — Phase 7

Previous task progress archived to metrics/progress-before-convective-storm.md

## convective-storm: Adventure framing translator

**Status:** Done

**What was built:**
- Created `packages/server/src/services/adventure-framing.ts` with `frameInputRequest` and `frameUserBlocker` functions
- Both functions call the haiku adapter to produce a one-sentence medieval D&D narrative framing
- Deterministic fallback when API key is absent: `"${name} pauses on the path and asks: \"${question}\""` / `"${name} halts to seek counsel: \"${description}\""`
- Output sanitization: strips HTML tags, collapses newlines, caps at 200 chars
- Extended `paused_input` event in `AgentEventSchema` with optional `adventureFraming` field
- Integrated into `quest-runner.ts`: after `setInputRequest()`, framing runs async (non-blocking); updates DB and publishes a follow-up `paused_input` WebSocket event with `adventureFraming` when ready
- 21 unit tests in `services/__tests__/adventure-framing.test.ts` (fallback, sanitization, tag-stripping, caps, haiku path)
- 2 integration tests in `__tests__/quest-runner.test.ts` verifying follow-up event + DB state
