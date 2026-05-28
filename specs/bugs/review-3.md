# BUG: `parseError` is sticky — never cleared between quests or after valid events

**Severity:** LOW
**File(s):**
- `packages/client/src/features/quest/use-quest-stream.ts`
- `packages/client/src/features/quest/hud-overlay.tsx`

## Problem

`useQuestStream` exposes a `parseError: string | null` that is set when the socket receives a malformed frame or a frame that fails `AgentEventSchema.safeParse(...)`. Once set, it is never cleared:

```ts
useEffect(() => {
  const handle = connectQuestSocket(questId, {
    onConnectionChange: setStatus,
    onParseError: (msg) => setParseError(msg),
    ...
  });
  return () => handle.close();
}, [questId]);
```

Two problems:

1. **Navigation between quests:** when `questId` changes, the effect tears down and rebuilds the socket, but `parseError` state stays. Quest B will display the parse error from quest A.
2. **Recovery from a transient malformed frame:** once a single bad frame is dropped, the red error banner stays in place forever even if every subsequent frame is valid. There is no UI affordance to dismiss it.

The error chip / banner in `hud-overlay.tsx` therefore acts as a one-way latch.

## Expected

Per `.claude/rules/ux-feedback.md`: "Error messages persist until dismissed by user action **or corrected input** — never auto-dismiss errors." A valid event arriving after a malformed one is "corrected input" and should clear the chip; a quest change should also clear it.

Per spec: "Malformed messages are rejected (Zod parse failure) without crashing the page; an error chip appears in the HUD." — the chip should reflect current state, not the all-time-worst frame.

## Fix

1. Reset `parseError` to `null` inside `onEvent` whenever a valid event is processed (corrected input).
2. Reset `parseError` to `null` at the top of the `useEffect` (or via a `useEffect(() => setParseError(null), [questId])`) so navigation between quests starts clean.
3. Optionally add a dismiss button to the parse-error banner in `hud-overlay.tsx` so the user can clear it on demand.
