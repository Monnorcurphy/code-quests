# BUG: Bell cue announcement doesn't re-fire on subsequent paused_input transitions

**Severity:** LOW
**File(s):** packages/client/src/features/quest/bell-cue.tsx

## Problem

`BellCue.onBell` resets the live-region by calling `setAnnounce(false)` immediately followed by `setAnnounce(true)` in the same callback:

```ts
const onBell = useCallback(() => {
  setAnnounce(false);
  if (!reducedMotion) {
    setRinging(true);
    ...
  }
  setAnnounce(true);
}, []);
```

React 18 automatically batches these updates, and React deduplicates identical state values — when `announce` is already `true`, calling `setAnnounce(false)` then `setAnnounce(true)` in the same batch commits the final value `true`, which matches the current state, so no re-render occurs.

Additionally, even if a re-render did occur, the sr-only span renders the *same* text — `"Bell rings — attention needed."` — every time. Assistive technologies announce aria-live regions only when their content changes; identical text after the first announcement is treated as no-op.

Combined effect: when a quest goes `paused_input → active → paused_input` (the spec calls out multiple input requests within a quest as "documented and out of scope but the second arriving overwrites the first"), the second transition fails to announce to screen reader users, even though the bell *visual* flashes. This violates the rule "Every audio cue needs a visual parallel" by going in the opposite direction — visible cue without an accompanying audible announcement.

## Expected

Per `.claude/rules/accessibility.md` and the task spec, the bell must emit an `aria-live="assertive"` announcement on every transition into `paused_input` or `user_blocked`. Successive transitions must each be announced.

## Fix

Force the live region's content to change on every trigger. Options (pick one):

1. Maintain a counter and include it in the announced text (off-screen) so the text differs each time:
   ```ts
   const [eventCount, setEventCount] = useState(0);
   const onBell = useCallback(() => {
     setEventCount((c) => c + 1);
     if (!reducedMotion) { /* ringing */ }
   }, []);
   ...
   {eventCount > 0 && (
     <span key={eventCount} role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
       Bell rings — attention needed.
     </span>
   )}
   ```
   The `key={eventCount}` causes React to remount the span — assistive tech treats a fresh node as new content and re-announces.

2. Alternatively, briefly set the text to empty, then back to the message via a microtask/`useEffect`:
   ```ts
   useEffect(() => {
     if (announceTrigger === 0) return;
     setText('');
     const id = setTimeout(() => setText('Bell rings — attention needed.'), 50);
     return () => clearTimeout(id);
   }, [announceTrigger]);
   ```

Either approach must be covered by an additional test in `bell-cue.test.tsx` that asserts the live-region content changes (or remounts) on a second `paused_input → active → paused_input` cycle.
