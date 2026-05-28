# BUG: Empty catch in framing IIFE swallows DB and publish errors

**Severity:** LOW
**File(s):** packages/server/src/services/quest-runner.ts (lines 134-136)

## Problem

```ts
} catch {
  // Framing is best-effort; errors are silently ignored
}
```

`frameInputRequest` already has its own try/catch and never throws — it always returns a sanitized string (real or fallback). The outer catch in the IIFE therefore can only fire on:
- `setInputRequest(...)` DB failures (disk full, locked DB, schema mismatch)
- `publishEvent(...)` throwing inside the WebSocket layer

Both of these are real operational signals. Other catch blocks in the same file (`quest-runner.ts:222-225`, `262-265`, `307-309`, `331-348`) write to `process.stderr`. This catch is inconsistent and silently loses errors that a maintainer would want to see.

Per `rules/common-findings.md` §8 (Silent error swallowing — 18 prior occurrences across 2 projects): every catch must surface the error OR explicitly mark itself with `// intentionally swallowed: <reason>`. The current comment ("Framing is best-effort; errors are silently ignored") implies the framing call itself, but the call cannot throw — the catch is swallowing different errors than the comment suggests.

## Expected

Match the rest of the file's pattern: log unexpected DB / publish errors to stderr so they show up in `metrics/` logs and incident packets.

## Fix

Replace the empty catch with a logged catch:

```ts
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    `[quest-runner] framing update error for quest ${quest.id}: ${msg}\n`,
  );
}
```
