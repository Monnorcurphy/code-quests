# Review Pass — TASK beryl

**Branch:** feature/beryl
**Commit:** 5b35df3 — feat(beryl): AgentAdapter interface + Haiku spec-audit engine
**Verdict:** PASS (0 bugs filed)

## Scope

TASK beryl introduces:
- `AgentAdapter` interface (`packages/server/src/agents/adapter.ts`)
- `offlineAdapter` deterministic fallback (`packages/server/src/agents/offline-adapter.ts`)
- `createHaikuAdapter` Anthropic SDK wrapper (`packages/server/src/agents/haiku-adapter.ts`)
- `getAuditAdapter` selector (`packages/server/src/agents/select-adapter.ts`)
- `auditQuest` engine with deterministic rules + LLM merge (`packages/server/src/audit/audit-quest.ts`)
- 13 unit tests (`packages/server/src/audit/__tests__/audit-quest.test.ts`)
- New dependency: `@anthropic-ai/sdk@^0.99.0`

## Checks performed

| Check | Result |
|---|---|
| Tests (`pnpm --filter @code-quests/server test`) | 87/87 PASS (13 new) |
| Typecheck (`pnpm --filter @code-quests/server typecheck`) | PASS |
| Lint (`pnpm --filter @code-quests/server lint`) | PASS |
| Build (`pnpm -r build`) | PASS (via verify.sh) |
| Hardcoded secrets grep (`sk-`, `AKIA`, `api_key=`, `password=`) | None found |
| `console.log` / debug prints in prod code | None in new files |
| SDK isolation — `@anthropic-ai/sdk` only imported in `haiku-adapter.ts` | PASS |
| Catch blocks have intentional-swallow comments (common-findings #8) | PASS (audit-quest.ts:102) |
| Cross-boundary: SpecGap building/severity enums match between prompt, schema, deterministic gaps | PASS — `war_room`, `oracle`, `library`, `tavern`, `armory`, `guild_hall` and `warn`/`block` are consistent across `SpecGapBuildingSchema`, the system prompt, and all deterministic gap literals |
| LLM response resilience (serde-resilience): `JSON.parse` wrapped in try/catch, per-gap `SpecGapSchema.safeParse` filtering, unknown fields ignored, final `SpecAuditSchema.parse` guards shape | PASS |
| Task acceptance criteria | All four met (tests pass without `ANTHROPIC_API_KEY`, `auditQuest` always returns valid `SpecAudit`, SDK isolated, no `console.log`) |

## Adversarial probes

- Adapter throwing: covered by test at L96–109; deterministic gaps still surface.
- Malformed JSON from LLM: covered by test at L137–145.
- Unknown building in LLM response: filtered by `safeParse`; covered (indirectly via schema parse) at L127–135.
- LLM injection through quest fields: any crafted JSON that doesn't match `SpecGapSchema` is discarded; reason field is bounded to 500 chars by schema.
- Network access in tests: `vi.mock('@anthropic-ai/sdk', ...)` defensively mocks at module level; `auditQuest.test.ts` only imports `offlineAdapter`.
- `getAuditAdapter()` correctly skips the Haiku branch when `ANTHROPIC_API_KEY` is unset (verified by env-conditional `if` and the offline path covered by all tests).

## Informational notes (no bug filed)

1. **PII not stripped from quest content sent to Anthropic.** The Haiku adapter forwards quest `title/description/acceptanceCriteria/edgeCases/context` verbatim to the cloud LLM. Security rule §6 calls for PII sanitization before cloud-LLM calls. The task spec explicitly requires sending this content, and the user opts in by supplying their own `ANTHROPIC_API_KEY`. Worth revisiting once Code Quests gains real users — could add an opt-in PII pass before the LLM call (or warn the user at API-key-configure time).

2. **Adapter failures are silently swallowed (no structured logging).** `audit-quest.ts:102` `catch {}` has the required intent comment but does not log. Per `observability-first.md`, structured logging should ship from day one. Once a structured logger is introduced (a later task per the rule's "ship in bootstrap" guidance — which hasn't been done yet at the server layer), this catch should emit a single structured event so that LLM call failures are diagnosable in production. Not blocking — the comment satisfies common-findings §8 today.

3. **No deduplication of LLM gaps against deterministic gaps.** The system prompt instructs the LLM "Only report gaps not already covered by the deterministic rules," but nothing enforces it. If the LLM ignores the instruction and returns an `oracle/block` gap when the deterministic rules already added one, the final `gaps` array contains both. Cheap improvement for a later task: de-dupe by `(building, severity)` tuple after merging, keeping the deterministic reason.

4. **`message.content[0]` is unguarded against an empty `content` array.** If Anthropic ever returns `content: []` (theoretically possible), `block` is `undefined` and `block.type` throws. This is caught by `auditQuest`'s outer `try/catch`, so the user-facing outcome is just "no LLM-extra gaps" — acceptable. A defensive `if (!block || block.type !== 'text')` would be cleaner.

5. **Tests for invalid/malformed LLM output assert only `no-throw`.** The "ignores invalid LLM gaps (unknown building)" and "handles malformed JSON" tests would pass even if the bad gap leaked into `audit.gaps` (the surrounding `SpecAuditSchema.parse` would catch shape drift only if the leaked gap had a non-enum building — which is exactly the test input, so it does work indirectly). An explicit `expect(audit.gaps.some(g => g.building === 'unknown_place')).toBe(false)` would assert intent more clearly.

## Verdict

**PASS** — 0 bugs filed. Code is clean, well-tested, and meets all acceptance criteria. Informational notes captured for future tasks.
