# BUG: /block async framing can overwrite `unblockedAt` set by /unblock
**Severity:** LOW
**File(s):** packages/server/src/routes/quests.ts

## Problem

In the `POST /quests/:id/block` route, the fire-and-forget framing call uses a gate
that compares only `currentBlocker.markedAt !== capturedNow` (line 707) to decide
whether to write the framing back into `user_blocker_json`.

`POST /quests/:id/unblock` (line 750) preserves the existing `markedAt` and merely
appends `unblockedAt`:

```ts
setUserBlocker(db, req.params.id, { ...existingBlocker, unblockedAt: now });
```

If the user blocks, then unblocks the quest before `frameUserBlocker()` resolves,
the gate fails to detect the unblock (markedAt unchanged), and the final
`setUserBlocker` call (lines 708–712) writes:

```ts
{ rawDescription, adventureFraming, markedAt: capturedNow }
```

`unblockedAt` is silently dropped, losing the historical record of when the user
came off the block.

Reproduction sketch:
1. POST `/quests/q/block` with description `X`. Background framing in flight.
2. POST `/quests/q/unblock`. `user_blocker_json.unblockedAt` is set.
3. Haiku call resolves. Gate passes (markedAt unchanged). Blocker is rewritten
   without `unblockedAt`.

## Expected

The framing writeback must not erase `unblockedAt`, regardless of how slow the
haiku call is. Either:
- Tighten the gate to also check `currentBlocker.unblockedAt === undefined`
  (or that the quest status is still `user_blocked`), OR
- Merge the framing onto the existing blocker via spread:
  `setUserBlocker(db, id, { ...currentBlocker, adventureFraming })`.

This matches the gating pattern used in `quest-runner.ts` for `input_request_json`,
where `clearInputRequest()` writes NULL and the framing closure checks for
`input_request_json` being non-null before overwriting.

## Fix

In `packages/server/src/routes/quests.ts` around lines 706–712, change the gate
and writeback to preserve any state set by a concurrent unblock:

```ts
const currentBlocker = getUserBlocker(db, req.params.id);
if (!currentBlocker || currentBlocker.markedAt !== capturedNow) return;
if (currentBlocker.unblockedAt) return; // quest already unblocked
setUserBlocker(db, req.params.id, {
  ...currentBlocker,
  adventureFraming,
});
```

Add a regression test in `packages/server/src/__tests__/quests-pause-block.test.ts`
that:
1. Blocks a quest.
2. Immediately unblocks it (before mocking out `frameUserBlocker` to resolve
   slowly, or by awaiting a flushed microtask queue).
3. Resolves the framing.
4. Asserts that `user_blocker_json.unblockedAt` is still present.
