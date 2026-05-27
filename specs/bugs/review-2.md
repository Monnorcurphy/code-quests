# BUG: Spawn `error` event is not handled — leaks temp file and hangs consumers

**Severity:** HIGH
**File(s):** packages/server/src/agents/cc-adapter.ts

## Problem

`spawnHandle()` registers handlers for `proc.stdout`, `proc.stderr`, and `proc.on('close', ...)`, but never listens for `proc.on('error', ...)`. Per Node's docs, if the subprocess cannot be spawned (e.g., ENOENT/EACCES at exec time, or the binary became unreadable between `findBinPath()` and `nodeSpawn()`), the child emits `'error'` and `'close'` may NOT follow. Even when `'close'` does follow, the existing handler will at least see a non-zero `code` — but the more common Node behavior is `'error'` without `'close'`.

When that happens:

1. The `AsyncQueue` is never `close()`d → any `for await (const ev of handle.events())` hangs forever.
2. `exitResolve` is never called → `awaitExit()` hangs forever.
3. The `/tmp/cq-mcp-*.json` file is never `unlink`ed → it leaks (with secrets, per [[review-1]]).
4. The `error` event itself becomes an unhandled `EventEmitter` error and crashes the Node process (Node 18+ default behavior for unhandled `'error'`).

In addition, the `spawnHandle` function eagerly calls `proc.stdin!.write(...)` before any error handler is registered. If spawn fails synchronously enough, that write itself can throw `ERR_STREAM_DESTROYED` and reject the outer promise without cleaning up the temp file.

This violates `rules/core/constitution.md §5` (hard gate on broken state — never continue silently) and rule §8 (PID-safe process management implies deterministic teardown).

## Expected

Subprocess errors must be surfaced to consumers, must clean up the temp file, must resolve `awaitExit`, must close the event stream, and must not crash the host process.

## Fix

In `packages/server/src/agents/cc-adapter.ts` inside `spawnHandle`, after `const proc = nodeSpawn(...)`:

```ts
let settled = false;
const finalize = (code: number | null, reason?: string) => {
  if (settled) return;
  settled = true;
  if (killTimer !== null) { clearTimeout(killTimer); killTimer = null; }
  const timestamp = new Date().toISOString();
  queue.push(
    code === 0 && !reason
      ? { type: 'completed', timestamp }
      : { type: 'failed', timestamp, reason: reason ?? `exit code ${String(code)}` },
  );
  queue.close();
  void unlink(tmpFile).catch(() => {}).then(() => exitResolve({ exitCode: code }));
};

proc.on('error', (err: Error) => finalize(null, `spawn error: ${err.message}`));
proc.on('close', (code: number | null) => {
  if (stdoutBuf.trim()) {
    const event = parseLine(stdoutBuf);
    if (event) queue.push(event);
  }
  finalize(code);
});
```

Then guard the stdin write so a destroyed stream cannot reject the outer promise unexpectedly:

```ts
try {
  proc.stdin?.write(buildPrompt(input));
  proc.stdin?.end();
} catch (_err) {
  // 'error' handler will fire and finalize; nothing to do here.
}
```

Add a regression test: point `CODE_QUESTS_CLAUDE_BIN` at an executable script that immediately self-deletes between resolve and spawn (or simulate by passing a non-executable file that `accessSync` was tricked into accepting), verify that `awaitExit()` resolves and the temp file is unlinked.
