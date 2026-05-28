# Review pass — task convective-storm

## Checks performed

- Read task spec (`metrics/task-convective-storm-context.md`) and pre-computed diff.
- Read new file `packages/server/src/services/adventure-framing.ts`.
- Read modified `packages/server/src/services/quest-runner.ts` in full to inspect the integration.
- Read `packages/server/src/agents/haiku-adapter.ts` to verify the adapter contract used by `frameInputRequest`/`frameUserBlocker`.
- Read `packages/shared/src/agent.ts` and `packages/shared/src/quest.ts` to confirm `adventureFraming` is optional and consistent across `AgentEventSchema` and `InputRequestSchema`/`UserBlockerSchema`.
- Read `packages/server/src/db/quest-repository.ts` to evaluate the async framing IIFE's interaction with `setInputRequest` / `clearInputRequest`.
- Read new tests (`services/__tests__/adventure-framing.test.ts`, additions in `__tests__/quest-runner.test.ts`).
- Ran `pnpm --filter @code-quests/server test` → 351/351 passing.
- Ran `pnpm -w typecheck` → clean.
- Ran `pnpm -w lint` → clean.
- Grep for hardcoded secrets in new code → none.
- Verified no `console.log` / debug output added to production code.
- Verified `adventureFraming` field naming is identical across `AgentEventSchema`, `InputRequestSchema`, and `UserBlockerSchema` (cross-boundary consistency).
- Verified `createHaikuAdapter` is throw-on-missing-key, and `frameInputRequest`/`frameUserBlocker` catch both that error and adapter call rejections; fallback paths covered by tests.
- Verified output sanitization (strip HTML tags, collapse `\r\n`, 200-char cap) and that the fallback string is itself passed through `sanitizeFraming`.

## Bugs filed

- `specs/bugs/review-1.md` — **CRITICAL**: async framing race condition writes stale `input_request_json` and emits a `paused_input` event after the quest has already `resumed`/`completed`. Demonstrated (and codified) by the new `runQuest adventure framing integration` test.
- `specs/bugs/review-2.md` — **LOW**: empty catch in the framing IIFE swallows DB / publish errors; inconsistent with the rest of `quest-runner.ts` which writes such errors to stderr.

## Informational notes

- **PII to cloud LLM (rule 6 in `rules/security.md`)**: `frameInputRequest` forwards the raw `question` and `context` (which can come from `cc-adapter` stdout markers) directly to the haiku endpoint. For a local dev tool with user-owned data this is borderline acceptable, but a future hardening pass could redact file paths / emails / repo names before the haiku call — especially when `context` is the agent's free-form blurb.
- **Prompt injection surface**: `Adventurer: ${adventurerName}. Question: ${rawQuestion}.${contextSuffix}` interpolates untrusted text into the prompt body. The blast radius is small (a single sentence of framing that gets sanitized to ≤200 chars), but the framing could be coerced into something off-tone. Not exploitable today; worth a thought when framings start influencing other downstream prompts.
- **`maxTokens: 80` vs "max 200 characters"**: the system prompt requests ≤200 chars, but 80 tokens ≈ 240–320 chars. The server-side `slice(0, 200)` catches overruns, but the model may be asked to stop mid-sentence. Cosmetic only.
- **`frameUserBlocker` is exported but unused**: the task spec lists "the block route" as a consumer but only step 5 (quest-runner integration of `frameInputRequest`) is acceptance-gated. `frameUserBlocker` is fully unit-tested and ready for the next task to wire into the block route.
- **System prompt wording vs spec wording**: the spec asks for "second-person about the adventurer" but the example (`"Brielle has reached a sealed door"`) and the implemented prompt are third-person. Implementation matches the example; not a bug.

## Verdict

**FAIL** — 2 bugs filed (1 CRITICAL, 1 LOW).
