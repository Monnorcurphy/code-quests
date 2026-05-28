# Review Pass — TASK cartagena (Claude Code subprocess adapter)

**Branch:** feature/cartagena
**Reviewer commit base:** 5a937cc feat(cartagena): Claude Code subprocess adapter
**Verdict:** FAIL — 4 bugs filed (2 HIGH, 2 LOW)

## Checks performed

- ✅ Pre-computed diff read end-to-end (cc-adapter.ts, select-adapter.ts, adapter.ts, both test files).
- ✅ `pnpm -F server test` → 145 / 145 pass, including the 3 cc-adapter tests + 2 missing-binary tests.
- ✅ `pnpm -F server typecheck` → clean.
- ✅ `pnpm -F server lint` → clean (no `no-console` violations).
- ✅ Hardcoded-secret grep (`sk-`, `AKIA`, `api_key`, `password=`) — none in new code.
- ✅ Cross-boundary check: `AgentEvent` shapes emitted by parser match `AgentEventSchema` discriminated union (`progress`, `combat`, `log`, `completed`, `failed`). All required fields present.
- ✅ `AgentSpawnInput` interface extended in `adapter.ts` with `adventurerClass?` and `mcpServers?`, matching new consumer in cc-adapter.
- ✅ `select-adapter.getQuestAdapter()` gates on both `CODE_QUESTS_USE_REAL_AGENT === '1'` AND `findBinPath() !== null`, per spec.
- ✅ PID-safety: never uses negative-PID group-kill (`kill(-pid)`); only signals the tracked `proc`.
- ✅ No third-party SDK imports; only Node builtins + `@code-quests/shared`.
- ✅ Temp file cleanup is wired to the `close` handler in the happy path and the non-zero-exit path (tests verify).
- ✅ Tests use a Node-as-fake-binary pattern, never invoke the real `claude` binary.

## Bugs filed

| # | Sev | Summary |
|---|-----|---------|
| [review-1](../bugs/review-1.md) | HIGH | Temp `.mcp.json` written world-readable; can leak MCP server secrets to other local users |
| [review-2](../bugs/review-2.md) | HIGH | Subprocess `'error'` event not handled — leaks temp file, hangs `awaitExit()` / event stream, can crash host on unhandled `'error'` |
| [review-3](../bugs/review-3.md) | LOW  | `cancel()` after exit can SIGKILL a recycled PID; repeated calls stack timers |
| [review-4](../bugs/review-4.md) | LOW  | stderr-derived `progress` events are not truncated to 1KB, unlike stdout-derived events |

## Informational notes (no bugs filed)

- **`--cwd` CLI flag.** The adapter passes `--cwd <input.cwd>` alongside setting `nodeSpawn`'s `cwd` option. The Claude Code CLI's published flag set typically does not include `--cwd` (the working directory is controlled by the spawn cwd). With the real binary, this could be rejected as an unknown flag. The spec explicitly mandates this flag, so it is in spec and not filed as a bug — but the project should validate against a real `claude --help` before relying on it in Phase 6+. Tests use a fake binary that ignores unknown args, so this is invisible to CI.
- **Prompt delivery via stdin.** The adapter writes the prompt to `proc.stdin` and ends. With `--print`, the canonical Claude Code invocation accepts the prompt as a positional arg or via stdin; behavior here matches the spec ("prompt = quest description + bulleted ACs"). Confirm against the real binary before merging Phase 4 capstone.
- **`AsyncQueue` is single-consumer by design.** Calling `handle.events()` twice would share buffer state — first iterator drains entries the second one expected. No callsite does this today; if a multi-consumer use case appears, switch to a fan-out queue or document the single-consumer contract on the `AgentHandle` interface.
- **TOCTOU on `findBinPath`.** A binary could vanish between the `accessSync` probe and `nodeSpawn`. [[review-2]]'s `'error'` handler resolves this in practice; no separate bug.

## Recommendation

Run the fixer to address the 4 filed bugs (review-1 and review-2 in particular — both can fail silently in production), then re-verify.
