# Review Pass — Task elnath

**Task:** Visual cues — silent-mode parity for every audio event
**Branch:** feature/elnath
**Parent:** feature/electra

## Checks performed

- Read the pre-computed diff (11 files, 764 insertions, 11 deletions).
- Read every new/modified source file:
  - `packages/client/src/audio/audio-cue-bus.ts`
  - `packages/client/src/audio/audio-controller.ts` (5 dispatchCue insertions)
  - `packages/client/src/audio/visual-cues/aria-announcer.tsx`
  - `packages/client/src/audio/visual-cues/pause-bell-flash.tsx`
  - `packages/client/src/audio/visual-cues/scene-mood-indicator.tsx`
  - `packages/client/src/audio/visual-cues/stinger-toast.tsx`
  - `packages/client/src/audio/visual-cues/__tests__/visual-cues.test.tsx`
  - `packages/client/src/components/app-shell.tsx`
  - `packages/client/src/lib/use-reduced-motion.ts`
  - `packages/client/src/styles/features.css`
- Confirmed `features.css` is imported in `main.tsx` (build chain end-to-end).
- Confirmed `AppShell` wires all 4 cue components on every route (`app-shell.tsx:17-20`).
- Ran `pnpm --filter @code-quests/client test`: **818 / 818 tests pass**.
- Ran `pnpm --filter @code-quests/client typecheck`: **clean**.
- Ran `pnpm --filter @code-quests/client lint`: **clean**.
- Grep for hardcoded secrets in new files: **none**.
- Verified `dispatchCue` is called for every `AudioEvent` variant via the controller (TOWN/ROAD/COMBAT/BOSS via loop dispatch; PAUSE_BELL on rising-edge; VICTORY_STINGER on encounter outcome; QUEST_COMPLETE / QUEST_FAILED on status transition).
- Verified `prefers-reduced-motion` handling: CSS `@media (prefers-reduced-motion: reduce)` + `[data-reduced-motion='true']` selector on `.scene-mood-indicator`, `.pause-bell-flash`, `.stinger-toast`. `useReducedMotion` hook subscribes to `matchMedia` change + MutationObserver on the doc element. Tests cover both the matchMedia and the data-attribute paths for PauseBellFlash linger timing.
- Verified no layout shift: all cue containers use `position: fixed` (mood indicator bottom-left, bell flash full-viewport, stinger toast top-center, announcer `.sr-only`).
- Verified contrast for cue text:
  - `.scene-mood-indicator` — `#f0e6d2` on `rgba(44,36,22,0.82)`: very high contrast, passes 4.5:1.
  - `.stinger-toast` — `#f0e6d2` on `rgba(30,24,14,0.92)`: very high contrast, passes 4.5:1.
- Verified the `StingerToast` dismiss button has an `aria-label`, `:focus-visible` outline, and is keyboard-operable.

## Bugs filed

- `specs/bugs/review-1.md` — **HIGH**: `StingerToast` uses `aria-live="polite"` for QUEST_FAILED; UX rule mandates `assertive` for error notifications. Also flags the duplicate announcement between the toast's aria-live region and `AriaAnnouncer`.

## Informational notes (not bugs)

- The `SceneMoodIndicator` `'has no animation class when prefers-reduced-motion'` test (`visual-cues.test.tsx:145-152`) only asserts `toBeDefined()` and does not actually verify the animation is suppressed. CSS handles reduced-motion through the media query (correct approach), so this isn't a bug — but the test name overstates what it checks. Consider tightening the assertion to inspect computed style or the `--static` modifier in a future polish pass.
- When a `VICTORY_STINGER` or `QUEST_COMPLETE` toast replaces an already-visible `QUEST_FAILED` toast (line 28-30 of `stinger-toast.tsx`), the error toast disappears without explicit user dismissal. The UX "error persists until dismissed" rule could be read to forbid this. In practice, the controller only emits QUEST_FAILED once per quest-status transition, so consecutive overlap is rare; left as-is for now but worth revisiting if real-world overlap causes confusion.
- The `AriaAnnouncer` will not re-announce the same event when it fires twice in a row (React state setter sees identical string → no re-render → no aria-live update). The audio-controller already filters consecutive duplicates at the source for every event (rising-edge for PAUSE_BELL, outcome transitions for VICTORY/COMPLETE/FAILED, `loopEvent !== currentLoopEvent` for loop events), so this is not a runtime gap today, but worth noting if a future feature dispatches non-idempotent duplicates directly to the cue bus.

## Verdict

**FAIL** — 1 HIGH bug filed (`specs/bugs/review-1.md`).
