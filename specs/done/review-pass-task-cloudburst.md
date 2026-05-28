# Review Pass — task cloudburst (Agent adapter pause/resume contract)

**Branch:** feature/cloudburst (parent: feature/arctic-storm)
**Commit:** d5d2047 — feat(cloudburst): agent adapter pause/resume contract
**Verdict:** FAIL — 3 bugs filed (2 HIGH, 1 LOW)

## Checks performed

- Read the task spec at `metrics/task-cloudburst-context.md` and walked each acceptance criterion.
- Read the full pre-computed diff for the 9 changed files.
- Read source for `adapter.ts`, `offline-adapter.ts`, `cc-adapter.ts`, `quest-runner.ts`, `haiku-adapter.ts`, `quest-repository.ts`, `quest-status.ts`, and the shared `AgentEvent`/`InputRequest` Zod schemas to validate cross-boundary types.
- Ran `pnpm typecheck` — clean.
- Ran `pnpm lint` — clean (no ESLint output, 0 errors / 0 warnings).
- Ran `pnpm --filter @code-quests/server test` — 324 tests across 25 files, all passing.
- Cross-boundary checks:
  - `AgentEventSchema.paused_input` (`question: z.string().min(1)`, `context?: string`) matches the regex captures and the `setInputRequest` payload shape.
  - `AgentEventSchema.resumed.source` enum (`input_response | user_unblock`) matches the literal `'input_response'` pushed from both adapters.
  - `QuestStatus` enum includes `'paused_input'`, which `transitionQuestStatus` exercises.
- Security / secret scan: no new hardcoded secrets, no `sk-`/`AKIA`/`api_key`/`password=` in the diff.
- Accessibility: no UI surface changes in this task.
- Code style: kebab-case file names preserved, no `console.log`, no `any`, no dead imports introduced.

## Bugs filed

| # | Severity | File | Summary |
|---|---|---|---|
| 1 | HIGH | `packages/server/src/services/quest-runner.ts` | `resumed` event is not passed to `persistEvents()`; spec step 4 requires both `paused_input` and `resumed` to be persisted. |
| 2 | HIGH | `packages/server/src/agents/cc-adapter.ts` | `proc.stdin.end()` removed without verifying behavior against the real `claude --print` binary; fake test binaries don't read stdin, so a likely production regression is invisible. |
| 3 | LOW | `packages/server/src/agents/cc-adapter.ts` | `respond()` pushes a `resumed` event even when `stdinStream.write()` throws — silent error swallow that misleads the quest-runner state machine. |

## Informational notes (no bug filed)

- The `PAUSED_INPUT_MARKER` regex `^\[\[PAUSED_INPUT question="([^"]*)"(?:\s+context="([^"]*)")?\]\]$` does not support escaped quotes inside `question` or `context`, and requires `context` to appear after `question`. This is acceptable for v1 — the marker is a controlled protocol — but if LLM output ever embeds a literal `"` in a question, the marker will silently fail to parse. Worth a follow-up if the protocol turns out to be brittle in practice.
- `pushPausedInput` permits an empty-string `question` (the regex allows `[^"]*` which matches zero chars). The shared `AgentEventSchema` requires `question.min(1)`, but the cc-adapter pushes events to the queue without Zod validation. Not currently a bug because the regex is the only producer and a well-formed marker shouldn't have an empty question, but worth a `.length > 0` guard if validation is desired at the boundary.
- The cc-adapter `respond()` always emits a `'resumed'` event even if the agent itself later emits an in-band `resumed` from a stdout marker. There's no de-duplication. Acceptable today because the cc-adapter doesn't parse a `resumed` marker, but worth tracking if the marker protocol grows.
- The capstone check (rule: "every phase ends interactable") does not apply here — cloudburst is mid-phase. The route layer wiring to expose `handle.respond()` via an HTTP endpoint is intentionally deferred to a later task; `getActiveHandle(questId)` is correctly exported so a future route can call into it.
- Acceptance criterion "haiku adapter no-op respond()" is satisfied: `haiku-adapter.ts` exposes only `complete`, no `spawn`, so `AgentHandle` (and `respond()`) doesn't apply to it. Confirmed by reading the file.

## Final verdict

**FAIL — 3 bugs filed.** Fix #1 (persist `resumed`) and #2 (cc-adapter stdin regression) before merging. #3 (silent-write-failure resumed event) should be fixed as part of the same pass.
