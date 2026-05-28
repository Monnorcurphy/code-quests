# Review Pass — Task gale: Mark-self-blocked control in HUD

**Branch:** feature/gale
**Parent:** feature/extratropical-cyclone
**Verdict:** **FAIL** — 3 bugs filed (1 HIGH, 2 LOW)

## Checks Performed

1. **Read pre-computed diff** for all 7 changed files (client + tests + progress.md).
2. **Read source files**:
   - `packages/client/src/features/quest/block-controls.tsx` (new)
   - `packages/client/src/features/quest/seek-counsel-dialog.tsx` (new)
   - `packages/client/src/features/quest/hud-overlay.tsx` (modified)
   - `packages/client/src/lib/api.ts` (added `block`/`unblock` methods)
3. **Cross-boundary check** between client `api.quests.block` and server `BlockQuestBodySchema`:
   - Client sends `{ description }`. Server validates `z.string().min(1).max(1000)`.
   - Client `maxLength={1000}` on textarea matches server upper bound. ✓
   - Client disables submit on `!description.trim()` (more restrictive than server's `min(1)` which would accept whitespace). No mismatch. ✓
   - Server route `POST /quests/:id/block` and `POST /quests/:id/unblock` exist and return 409 on illegal state — handled by client. ✓
4. **Verification gates**:
   - `pnpm --filter @code-quests/client typecheck` → clean ✓
   - `pnpm --filter @code-quests/client lint` → clean ✓
   - Full client test suite: 45 files / 624 tests pass ✓
5. **Secrets grep**: no `sk-`, `AKIA`, `api_key`, `password=` introduced. ✓
6. **Debug output**: no `console.log` or stray `print` in new application source. ✓
7. **Accessibility audit**:
   - `text-white`, `text-gray-{600..900}`, `text-red-700` used appropriately. No banned `text-gray-{100..400}` classes.
   - `text-red-300` used for inline error in HUD — verified against dark HUD background `rgba(30,20,10,0.85)`; contrast > 4.5:1. ✓
   - Buttons have visible labels and `aria-label`/`aria-busy`. ✓
   - Dialog has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Form label is correctly associated to textarea. ✓
   - Error spans use `role="alert"` + `aria-live="assertive"`. ✓
   - ESC closes dialog; focus moves to textarea on open; document-level keydown handler attempts focus return on unmount (though untested — see review-2). ✓
8. **Input validation**: textarea is `maxLength={1000}`, submit disabled when empty, character counter visible. ✓
9. **Effect dependency stability**: see bug review-3.

## Bugs Filed

| # | Severity | Title |
|---|----------|-------|
| review-1 | HIGH | "Resuming…" indicator does not persist until WebSocket confirms `active` (spec violation) |
| review-2 | LOW | Focus management not verified by tests (focus trap cycling + focus return on close untested) |
| review-3 | LOW | `onClose` and backdrop `onClick` callbacks not memoized — keydown effect re-attaches on every parent re-render |

## INFORMATIONAL Notes

- **Backdrop click during loading** (`seek-counsel-dialog.tsx:77`): the backdrop click handler closes the dialog unconditionally even while the block request is in flight, but the Cancel button is `disabled={loading}`. For consistency, either both should be active or both blocked. Defer to design preference; not a hard bug.
- **Title casing inconsistency**: trigger label is "Seek counsel" (sentence case), dialog heading is "Seek Counsel" (title case). Minor copy nit; could be unified after gustnado styling pass.
- **Dialog lacks `aria-describedby`**: only the heading is announced. A short description (e.g., "Pause the quest while you gather information") could help screen-reader users understand the action. Future polish.
- **Title-case capitalization on labels**: not a blocker; gustnado is the styling owner per the spec.

## Cross-Boundary Validation Summary

| Boundary | Client | Server | Match |
|----------|--------|--------|-------|
| `POST /quests/:id/block` body | `{ description: string }` | `z.object({ description: z.string().min(1).max(1000) })` | ✓ |
| `POST /quests/:id/unblock` body | `{}` | no body validation | ✓ |
| Status enum | `'active' \| 'paused_input' \| 'user_blocked'` checked in component | `transitionQuestStatus(...)` rejects illegal transitions | ✓ |
| 409 / 410 error path | Client renders inline message + invalidates `['quest', questId]` cache | Server returns 409 with `{ error }` body | ✓ |

## Final Verdict

**FAIL** — 1 HIGH bug (`review-1`) violates an explicit acceptance criterion; 2 LOW bugs document missing test coverage and minor reliability/perf issues. Fixer must address all three before this task can pass.
