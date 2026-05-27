# BUG: Magic readyState number in quest-socket.ts

**Severity:** LOW
**File(s):** packages/client/src/lib/quest-socket.ts

## Problem

`send()` checks `s.readyState === 1` using a raw numeric literal instead of
the named WebSocket constant. The numeric literal is opaque — a reader has to
look up the WebSocket protocol spec to understand that `1` means OPEN. This
also makes the code inconsistent with the server-side `quest-channel.ts`,
which uses `WebSocket.OPEN` (an imported constant) for the equivalent check.

```ts
function send(msg: unknown): void {
  if (s !== null && s.readyState === 1) {  // magic number
    s.send(JSON.stringify(msg));
  }
}
```

## Expected

Use the named constant `WebSocket.OPEN` (which equals `1` per the WebSocket
protocol). Named constants are required by the project's general code-quality
conventions and match how the same check is written on the server side.

## Fix

Replace the magic number with the named WebSocket constant:

```ts
function send(msg: unknown): void {
  if (s !== null && s.readyState === WebSocket.OPEN) {
    s.send(JSON.stringify(msg));
  }
}
```

`WebSocket` is a browser global with the standard `OPEN = 1` static property,
so no import is needed for the client build. (The fake WebSocket in the test
file already defines `static readonly OPEN = 1`, so existing tests will still
pass.)
