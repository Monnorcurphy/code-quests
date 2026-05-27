# BUG: stderr output is emitted unbounded — no 1KB truncation

**Severity:** LOW
**File(s):** packages/server/src/agents/cc-adapter.ts

## Problem

The stdout-line parser truncates every message body to 1024 bytes via `text.length > 1024 ? text.slice(0, 1024) : text`. The stderr handler does not:

```ts
proc.stderr!.on('data', (chunk: Buffer) => {
  const text = chunk.toString('utf8').trim();
  if (text) {
    queue.push({
      type: 'progress',
      timestamp: new Date().toISOString(),
      message: `warning: ${text}`,
    });
  }
});
```

If the binary writes a long Node stack trace, a multi-MB warning, or a verbose log dump to stderr, the whole blob enters the event stream verbatim and downstream consumers (WebSocket pushes, DB writes) eat the full payload. This is a context/log-volume problem and contradicts the parser's stated 1KB-truncation invariant for `message` fields.

## Expected

stderr-derived `progress` events should obey the same 1024-byte ceiling as stdout-derived events. Multi-line stderr should also be chunked sensibly rather than emitted as one giant string.

## Fix

In `packages/server/src/agents/cc-adapter.ts`, truncate the stderr text the same way the parser does:

```ts
proc.stderr!.on('data', (chunk: Buffer) => {
  const text = chunk.toString('utf8').trim();
  if (!text) return;
  const truncated = text.length > 1024 ? text.slice(0, 1024) : text;
  queue.push({
    type: 'progress',
    timestamp: new Date().toISOString(),
    message: `warning: ${truncated}`,
  });
});
```

Optionally split on `\n` first so each stderr line becomes its own event (mirrors the stdout treatment).
