# BUG: "Resuming…" indicator does not persist until WebSocket confirms active

**Severity:** HIGH
**File(s):** `packages/client/src/features/quest/block-controls.tsx`

## Problem

In `handleUnblock`, `setUnblockLoading(false)` is called immediately after the unblock HTTP request resolves successfully (line 24). However, the WebSocket `status_change` event from the server may arrive after the HTTP response. This causes a brief but visible regression of the button from "Resuming…" back to "Unblock" before the component finally unmounts when the status changes to `active`.

```ts
try {
  await api.quests.unblock(questId);
  setUnblockLoading(false);   // <-- clears immediately; "Unblock" briefly re-renders
} catch (err) { ... }
```

## Expected

Per the task spec (gale, step 3):

> Disable it while the request is in flight; show a small "Resuming..." indicator **until the WebSocket status_change confirms `active`**.

The "Resuming…" indicator should persist after the HTTP response and only stop when the status transitions to `active` (which causes the entire control to unmount). The current implementation contradicts this acceptance criterion.

## Fix

Do NOT clear `unblockLoading` on the success path. Since the component renders only when `status === 'user_blocked'`, the WebSocket-driven status change to `active` will cause `BlockControls` to unmount its `user_blocked` branch — there is no need to manually clear the loading state on success. Only clear it on error so the user can retry.

```ts
try {
  await api.quests.unblock(questId);
  // Do not clear unblockLoading — leave "Resuming…" visible until the
  // WebSocket status_change to 'active' unmounts this branch.
} catch (err) {
  // ... existing error handling
  setUnblockLoading(false);  // keep this
}
```

Add a test that mocks `api.quests.unblock` to resolve and asserts the button still reads "Resuming…" (and remains disabled) until the parent re-renders with `status === 'active'`.
