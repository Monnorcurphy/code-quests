# BUG: QUEST_FAILED stinger toast uses aria-live="polite" instead of "assertive"
**Severity:** HIGH
**File(s):** packages/client/src/audio/visual-cues/stinger-toast.tsx

## Problem
`StingerToast` hardcodes `aria-live="polite"` on its container (`stinger-toast.tsx:51`) even when displaying the QUEST_FAILED error notification. Per the UX Design Principles rule (`# UX Design Principles` → "What just happened?"), error notifications must use `aria-live="assertive"` so screen reader users are interrupted to hear the failure rather than queuing the announcement behind ongoing speech.

QUEST_FAILED is unambiguously the error case in this component:
- It is persistent (`persistent = event === 'QUEST_FAILED'`)
- It receives the `.stinger-toast--error` class (visually styled red)
- It shows a dismiss button
- The text reads "Quest failed — returned to town"

A screen reader user mid-action when their quest fails should be interrupted, not have the failure announcement queued behind whatever else is being read out.

Additionally, the same string is announced by `AriaAnnouncer` (which also uses `aria-live="polite"`) — meaning today a screen reader will read "Quest failed — returned to town" twice politely. Picking one channel as the authoritative announcer (and using `assertive` for the error there) avoids both the rule violation and the duplicate announcement.

## Expected
Per `rules/ux-design.md`:
> **Error**: Persist until user dismisses or retries successfully. `aria-live="assertive"`. Human-friendly copy, not error codes.

The QUEST_FAILED toast's aria-live region must be `assertive`. Success stingers (VICTORY_STINGER, QUEST_COMPLETE) should remain `polite`.

## Fix
1. In `packages/client/src/audio/visual-cues/stinger-toast.tsx`, derive `aria-live` from the toast variant:
   ```tsx
   <div
     className={...}
     aria-live={toast.persistent ? 'assertive' : 'polite'}
     aria-atomic="true"
     data-testid="stinger-toast"
   >
   ```

2. Resolve the duplicate announcement between `StingerToast` and `AriaAnnouncer`. Either:
   - Remove the `aria-live` region from `StingerToast` entirely (let `AriaAnnouncer` be the sole announcer) and instead make `AriaAnnouncer` switch to `aria-live="assertive"` when announcing QUEST_FAILED; OR
   - Suppress QUEST_FAILED in `AriaAnnouncer` (so only the toast announces it) and keep the toast's `aria-live` as the assertive error channel.

3. Add tests asserting:
   - `stinger-toast` has `aria-live="assertive"` when QUEST_FAILED is showing.
   - `stinger-toast` still has `aria-live="polite"` for VICTORY_STINGER and QUEST_COMPLETE.
   - The QUEST_FAILED announcement is produced by exactly one aria-live region (no duplicate).

4. Update the existing test at `visual-cues.test.tsx:54-59` ("renders a polite aria-live region" — currently on AriaAnnouncer) to reflect any aria-live change made to AriaAnnouncer.
