# BUG: `cancel()` can SIGKILL a recycled PID and never clears its timer on multiple calls

**Severity:** LOW
**File(s):** packages/server/src/agents/cc-adapter.ts

## Problem

Two related defects in `cancel()`:

1. **Post-exit signal to recycled PID.** If `cancel()` is called after the child has already exited, `proc.kill('SIGTERM')` is a no-op against Node's tracked PID, but `setTimeout(() => proc.kill('SIGKILL'), 5000)` still schedules a SIGKILL 5s later. On Linux/macOS, PID reuse means that the OS could have assigned the same numeric PID to a totally unrelated process by then, and Node's `proc.kill()` ultimately calls `process.kill(pid, signal)` which does NOT validate that the PID still belongs to the original child. Result: we can send SIGKILL to an unrelated process. This collides with `rules/core/constitution.md §8` ("Kill only tracked PIDs… use PID files for safe emergency stop").

2. **Repeated cancel calls leak timers and stack signals.** Each call to `cancel()` overwrites `killTimer` without clearing the previous one, so each call schedules a SIGKILL that will fire regardless of whether `close` was observed in between. Two quick cancels → two pending SIGKILLs.

## Expected

`cancel()` must:
- be a no-op if the child has already exited (no SIGTERM, no SIGKILL timer),
- not stack timers across repeated calls,
- only signal the originally-spawned PID while it is still alive.

## Fix

Track whether the process has exited and clear any prior timer before scheduling a new one:

```ts
let exited = false;
proc.on('exit', () => { exited = true; });

// ... in cancel():
async cancel(): Promise<void> {
  if (exited) return;
  if (killTimer !== null) clearTimeout(killTimer);
  proc.kill('SIGTERM');
  killTimer = setTimeout(() => {
    if (!exited) proc.kill('SIGKILL');
  }, 5000);
},
```

Add a regression test that calls `cancel()` after `awaitExit()` resolves and asserts that no extra `proc.kill` is issued (e.g., spy on `proc.kill`).
