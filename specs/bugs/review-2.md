# BUG: cc-adapter removes `proc.stdin.end()` without verifying real `claude --print` behavior

**Severity:** HIGH
**File(s):** `packages/server/src/agents/cc-adapter.ts`

## Problem

The previous cc-adapter wrote the prompt to stdin and **closed** it:

```ts
proc.stdin!.write(buildPrompt(input));
proc.stdin!.end();
```

The cloudburst change removes `proc.stdin!.end()` and leaves stdin open so `respond()` can write back later:

```ts
const stdinStream = proc.stdin!;
try {
  stdinStream.write(buildPrompt(input));
  // Keep stdin open so respond() can write back when paused_input arrives.
  // The subprocess will see EOF only after stdinStream.end() is called or it exits.
} catch { ... }
```

`claude --print` is documented (and behaves) as a one-shot batch invocation that reads its prompt from stdin until EOF, then prints a single result and exits. Without EOF, the subprocess may block indefinitely waiting for more input — never starting the actual model call. **This silently breaks every existing happy-path cc-adapter invocation that doesn't involve a pause.**

The cc-adapter test suite cannot catch this regression: every fake binary in `cc-adapter.test.ts` (`fakeBinSuccess`, `fakeBinFail`, `fakeBinSlow`, `fakeBinBadShebang`, the new marker binaries) is a node script that writes to stdout and exits without ever reading stdin. The fakes simply don't exercise the EOF-dependent behavior of the real binary.

The pause/resume design needs a different shape — either an interactive claude session mode that genuinely streams from stdin, or a separate write channel for the response — but the present implementation pairs a likely production regression with a test harness that hides it.

## Expected

- The cc-adapter must not silently regress the existing happy path. Either:
  - Re-close stdin after writing the prompt and adopt a different mechanism for `respond()` (e.g., spawn an interactive `claude` session, use a stdin pipe only when a marker has appeared, or document explicitly that the cc-adapter is currently pause-only), OR
  - Verify empirically against the real `claude --print` binary that leaving stdin open does not stall the subprocess, and add at minimum a manual verification note plus an integration test that runs against the real binary (gated behind an env var if needed).
- The fake test binaries must be augmented so that at least one test actually reads from its own stdin and asserts the prompt was delivered — otherwise the regression is invisible to CI.

## Fix

1. Decide on the production-safe path for `respond()` (interactive session, secondary pipe, or alternate transport).
2. Restore `stdinStream.end()` on the non-marker path, or add a documented integration test that proves the change works against the real binary.
3. Add at least one fake-binary test that reads its own stdin and asserts the prompt content arrived — closing the regression gap.
4. If the keep-stdin-open behavior is in fact correct for `claude --print`, leave a code comment citing the verification (binary version + manual test command).
