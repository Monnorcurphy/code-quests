# Review Pass — TASK gustnado (Phase 7 Capstone)

**Branch:** feature/gustnado
**Parent:** feature/gale
**Reviewer:** adversarial code reviewer (separate session)
**Verdict:** FAIL — 2 LOW bugs filed; capstone coverage PASS

## Checks Performed

- ✅ Read pre-computed diff (14 files, +1374 / -19 lines)
- ✅ Read task spec from `metrics/task-gustnado-context.md`
- ✅ Read all new source files (`paused-input-modal.tsx`, `user-blocked-modal.tsx`, `bell-cue.tsx`, modified `hud-overlay.tsx`, modified `seek-counsel-dialog.tsx`)
- ✅ Read new test files (3 unit tests + 1 Playwright E2E)
- ✅ Read styles addition (`features.css` — parchment tokens + bell-ring keyframes)
- ✅ Vitest client suite: 48 files, 655 tests — all pass
- ✅ `pnpm -C packages/client lint` — clean
- ✅ `pnpm -C packages/client typecheck` — clean
- ✅ `checks/contrast-classes.sh` — 10 hits, ALL pre-existing on parent branch `feature/gale` (verified via `git show feature/gale:.../hud-overlay.tsx` — none introduced by this task)
- ✅ Cross-boundary validation:
  - Frontend `respondInput(id, text)` sends `{text}`; server `RespondInputBodySchema = z.object({ text: z.string().min(1).max(4000) })` matches
  - Frontend textarea `maxLength={4000}` matches server cap exactly
  - Frontend block description `maxLength={1000}` matches server `BlockQuestBodySchema` cap
  - `InputRequest` and `UserBlocker` types imported from `@code-quests/shared` and used identically on both sides
- ✅ Secrets grep (`sk-`, `AKIA`, `api_key`, `password=`) — none in diff
- ✅ Capstone coverage: BellCue, PausedInputModal, UserBlockedModal wired unconditionally into `hud-overlay.tsx`; reachable from the quest route; phase-7-walkthrough.md describes the human interaction path end-to-end
- ✅ Focus trap implementations in both modals (custom FocusTrap component; Tab cycles; ESC focuses cancel/unblock per spec)
- ✅ `aria-modal="true"` on both dialogs; `aria-labelledby` / `aria-describedby` wired
- ✅ Reduced-motion gating: `bell-ring` CSS animation respects `@media (prefers-reduced-motion: reduce)`; bell-cue.tsx skips animation when `reducedMotion` detected, preserves announcement
- ✅ Error handling: both modals catch errors, surface via `role="alert"` (assertive), keep form state populated, do not swallow
- ✅ Loading state on async buttons; `aria-busy` on submit
- ✅ Test isolation: API calls mocked, store reset in beforeEach, mocks cleared in afterEach
- ✅ No conditional assertions in tests
- ✅ No `console.log` in production source (lint enforces)
- ✅ No `text-{gray,neutral,slate,zinc}-{100..400}` introduced by this task (only pre-existing usage in unchanged hud-overlay lines)

## Bugs Filed

| # | Severity | Title |
|---|----------|-------|
| review-1 | LOW | Bell cue announcement doesn't re-fire on subsequent paused_input transitions |
| review-2 | LOW | PausedInputModal body uses contradictory role="status" + aria-live="assertive" |

## Informational Notes (not bugs)

1. **Dead title-generation code**: `PausedInputModal` declares `const adventurerName = undefined;` and conditionally builds `${adventurerName} encounters a fork…` but the branch is unreachable. The spec allows "The path forks…" as a valid fallback, so this is spec-compliant — but a future task could wire the adventurer name in from the store for stronger immersion.

2. **`useBellEvent` runs `useEffect` with no dependency array**, so it re-runs every render. The `prev !== status` guard prevents spurious callback invocations, but the hook is unnecessarily wasteful. A `[status, callback]` dep array would be cleaner. Functionally correct.

3. **Loading state stays `true` after successful `respondInput` / `unblock`**: both modals rely on the WebSocket status change to unmount the modal. If the WS event is dropped or delayed, the modal remains in loading state with no recovery path. Acceptable for v1 given the WS reconnect logic from earlier tasks, but worth revisiting if loss-of-event is observed in practice.

4. **Two stacked focus traps when `Edit description` opens `SeekCounselDialog` over `UserBlockedModal`**: both register document-level keydown listeners. Traced through: Tab still cycles correctly within the topmost dialog (the underlying trap doesn't match `document.activeElement` in its querySelectorAll); ESC fires both handlers (inner closes, outer focuses Unblock, but inner's cleanup focuses the Edit-description trigger button, which is the desired final focus). Works correctly but the layering is brittle — if a future change reorders mount sequence, focus could land in the wrong place.

5. **E2E test typing**: `Parameters<typeof test.fn>[0]['page']` is a non-standard way to obtain Playwright's `Page` type. `import type { Page } from '@playwright/test'` would be the conventional form. Typecheck passes, so functionally fine.

6. **Hud-overlay contrast violations (10 hits)** flagged by `checks/contrast-classes.sh` are pre-existing on `feature/gale` and not introduced by this task. They should be fixed in their own bug-bash pass rather than scoped to this review.

## Final Verdict

**FAIL — 2 LOW bugs to address.**

Both bugs are accessibility polish issues. The task's core acceptance criteria are met: parchment modals render with adventure framing, bell flashes on paused/blocked transitions, reduced-motion is respected, focus management works, E2E coverage exists, axe-core assertions are in place, and the walkthrough document captures the human interaction path. Phase 7 is interactable end-to-end. Address the two LOW bugs in the fixer pass to clear the review.
