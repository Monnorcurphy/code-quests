# Progress — Phase 9

Previous task progress archived to metrics/progress-before-elder.md

## elder — Quest remedy actions (complete)

**Delivered:**
- `packages/client/src/features/hall-of-returns/actions/action-bar.tsx` — three action buttons (Re-post, Retire, Break into Smaller Quests); recommended action gets badge + `aria-current="true"`; toast region with 4s auto-dismiss; linkage display after successful re-post or split
- `packages/client/src/features/hall-of-returns/actions/repost-dialog.tsx` — modal pre-filling quest ACs and edge cases; submit disabled when all ACs cleared; loading/error states; focus trap + Escape to close; focus returns to trigger button
- `packages/client/src/features/hall-of-returns/actions/retire-dialog.tsx` — confirmation modal with permanent-action warning; Cancel button focused on mount (safest action); focus trap + Escape; loading/error states
- `packages/client/src/features/hall-of-returns/actions/split-dialog.tsx` — dynamic child quest stubs (min 2); Submit disabled until ≥2 valid children; add/remove child quests and ACs; loading/error states; focus trap
- `packages/client/src/features/hall-of-returns/actions/__tests__/*.test.tsx` — 58 tests covering all dialogs: open/close, validation, happy path, server error, focus management
- `packages/client/src/lib/api.ts` — added `quests.repost`, `quests.retire`, `quests.split` with Zod-validated response types
- `packages/client/src/features/hall-of-returns/post-mortem.tsx` — renders ActionBar below FailureSummaryCard

**Verify:** 910 tests pass, typecheck clean, lint clean
