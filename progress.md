# Progress — Phase 7

Previous task progress archived to metrics/progress-before-gale.md

## Task gale — Mark-self-blocked control in HUD

**Status:** Complete

### What was done

- Added `api.quests.block(id, description)` and `api.quests.unblock(id)` to `packages/client/src/lib/api.ts`
- Created `packages/client/src/features/quest/seek-counsel-dialog.tsx`: parchment-styled dialog with a textarea labeled "What are you waiting on?" (max 1000 chars), "Mark blocked" submit, and "Cancel" button. Calls `POST /api/quests/:id/block`. Focus trapping (Tab cycles within dialog), ESC closes, focus returns to trigger button on close.
- Created `packages/client/src/features/quest/block-controls.tsx`: extracted component rendering the "Seek counsel" button (active/paused_input) and "Unblock" button (user_blocked) with loading/error states. 409/410 errors show "The agent is no longer running this quest" and trigger a React Query invalidation. Extracted to keep hud-overlay.tsx under 300 lines.
- Updated `packages/client/src/features/quest/hud-overlay.tsx` to render `<BlockControls questId={questId} status={displayStatus} />` in the top banner.
- Tests: 35 new tests across `seek-counsel-dialog.test.tsx` and `block-controls.test.tsx` covering button visibility by status, dialog open/close, loading states, API calls, error handling.

### Files created/modified
- `packages/client/src/lib/api.ts`
- `packages/client/src/features/quest/seek-counsel-dialog.tsx` (new)
- `packages/client/src/features/quest/block-controls.tsx` (new)
- `packages/client/src/features/quest/hud-overlay.tsx`
- `packages/client/src/features/quest/__tests__/seek-counsel-dialog.test.tsx` (new)
- `packages/client/src/features/quest/__tests__/block-controls.test.tsx` (new)
