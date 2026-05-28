# BUG: cc-adapter `respond()` emits `resumed` even when stdin write fails

**Severity:** LOW
**File(s):** `packages/server/src/agents/cc-adapter.ts`

## Problem

In `cc-adapter.ts` lines 281-289:

```ts
async respond(text: string): Promise<void> {
  if (settled) return;
  try {
    stdinStream.write(text + '\n');
  } catch {
    // stdin may be closed — best effort
  }
  queue.push({ type: 'resumed', timestamp: new Date().toISOString(), source: 'input_response' });
}
```

If `stdinStream.write()` throws (e.g., EPIPE because the subprocess already exited or closed stdin), the catch block swallows the error and the adapter still emits a `resumed` event. Downstream, `quest-runner.ts` transitions the quest from `paused_input` → `active` and clears `input_request_json` — making it look like the agent successfully received the input when it did not. The agent may then exit with no further output, leaving a quest stuck in `'active'` with no progress and no surfaced error.

This pattern matches Common Review Finding #8 (Silent Error Swallowing): the error is caught with a one-line excuse but no observable signal is produced.

## Expected

When the write fails, the adapter should either:
- Surface a `failed` event with a clear reason ("Could not deliver response to agent: stdin closed"), and skip the `resumed` push, OR
- Log the error visibly (`process.stderr.write(...)`) AND skip the `resumed` push so the quest stays in `paused_input` and the operator can investigate / cancel.

A spurious `resumed` event that doesn't reflect reality is a misleading source of truth.

## Fix

Track whether the write actually succeeded and gate the `resumed` push on success. Surface failure through `stderr` and/or a `failed` event:

```ts
async respond(text: string): Promise<void> {
  if (settled) return;
  let wrote = false;
  try {
    stdinStream.write(text + '\n');
    wrote = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[cc-adapter] respond() write failed: ${msg}\n`);
  }
  if (wrote) {
    queue.push({ type: 'resumed', timestamp: new Date().toISOString(), source: 'input_response' });
  } else {
    queue.push({
      type: 'failed',
      timestamp: new Date().toISOString(),
      reason: 'Could not deliver response to agent (stdin closed)',
    });
  }
}
```

Add a regression test using a fake binary whose stdin closes immediately, then invoke `respond()` and assert that `resumed` is NOT emitted (or that `failed` is emitted) — preventing the quest from being marked `active` on a broken transport.
