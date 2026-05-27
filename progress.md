# Progress — Phase 3

Previous task progress archived to metrics/progress-before-fluorite.md

## fluorite — Dispatch action (POST /quests/:id/dispatch + UI button)

**Status:** Complete

### Backend
- Added `POST /quests/:id/dispatch` to `packages/server/src/routes/quests.ts`
  - Checks status is `idle`, returns 409 if already dispatched
  - Runs `auditQuest()` via `getAuditAdapter()`
  - If block gaps and no `?bypass=true` → 409 with `{ error, audit }`
  - Otherwise: sets `status='active'`, `ac_locked_at=now()`, `spec_audit_json` with `bypassed` flag, returns 200 quest
- New test file `packages/server/src/__tests__/dispatch.test.ts` (7 tests covering: 404, 409 non-idle, 409 block gaps, 200 success, 200 bypass, AC lock after dispatch, non-AC patch still works)

### Frontend
- Extended `ApiError` in `packages/client/src/lib/api.ts` with `data?: unknown` to carry raw 409 body (audit included)
- Added `api.quests.dispatch(id, bypass?)` to the api client
- New component `packages/client/src/features/quests/dispatch-button.tsx`
  - Three UX states: idle "Dispatch quest", loading (spinner + disabled), success (3s auto-dismiss then close modal)
  - On 409 with block gaps: shows audit inline with "Dispatch anyway" button
  - "Dispatch anyway" triggers parchment-style confirm panel with 2-second countdown before confirm enables
  - Error state (non-409) persists until user action
- Mounted `<DispatchButton quest={quest} />` in `QuestDetailSection` of `packages/client/src/features/war-room.tsx`
- Added dispatch CSS classes to `packages/client/src/styles/features.css`
- New test file `packages/client/src/__tests__/dispatch-button.test.tsx` (10 tests covering all UX states, countdown, bypass flow, error persistence)

### Verify
- All 112 server tests pass (7 new dispatch tests)
- All 240 client tests pass (10 new dispatch-button tests)
- `pnpm typecheck` clean
- `pnpm lint` clean
