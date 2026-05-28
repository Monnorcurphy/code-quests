# Review Pass — Task fluorite (Dispatch action)

## Checks performed

- Read `metrics/task-fluorite-context.md` (task spec)
- Read all touched source: `packages/server/src/routes/quests.ts`, `packages/server/src/__tests__/dispatch.test.ts`, `packages/client/src/features/quests/dispatch-button.tsx`, `packages/client/src/__tests__/dispatch-button.test.tsx`, `packages/client/src/features/war-room.tsx`, `packages/client/src/lib/api.ts`, `packages/client/src/styles/features.css`
- Cross-boundary check: server `POST /quests/:id/dispatch` sets `status='active'` — matches the `CHECK(status IN ('idle', 'active', …))` constraint in `packages/server/src/db/migrations/001_init.sql` line 31 and the `QuestStatusSchema` enum in `packages/shared/src/quest.ts`. The `bypass` query param is checked as the literal string `'true'` against `req.query['bypass']` — frontend `api.quests.dispatch` always sends exactly `?bypass=true`, so the boundary matches.
- The 409 body shape `{ error, audit }` is parsed by the client through `SpecAuditSchema.safeParse(body?.audit)`. `SpecAuditSchema` accepts `runAt`, `gaps`, `bypassed` — server returns the same. Match.
- Foreign-key pragma: not directly touched, but the existing `openDb` path used in the new dispatch tests already runs migrations with `PRAGMA foreign_keys = ON` per the existing setup.
- AC-lock invariant: dispatch route sets `ac_locked_at` once the quest is moved to `active`. The existing PATCH guard at `quests.ts:140` then rejects `acceptanceCriteria` edits. Covered by `dispatch.test.ts` `'subsequent PATCH on acceptanceCriteria returns 400 after dispatch'`.
- Secrets/PII grep: no `sk-`, `AKIA`, `api_key`, `password=`, or `console.log` in the new files. Server uses `process.stderr.write` for error logging — acceptable.
- Lint, typecheck, and the full test suite all pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`).
- Build-output filtering, error-handling on both new endpoints, and `aria-busy`/`aria-live` on the button all conform to the rules.

## Bugs filed

- `specs/bugs/review-1.md` (HIGH): success banner is invisible in production because the React Query refetch flips `quest.status` to `active` and the component's early-return removes the banner before the 3-second timer elapses.
- `specs/bugs/review-2.md` (HIGH): bypass-confirm alertdialog does not manage focus, traps, or restoration — violates `state-management.md` "Focus Management in Modals and Panels". `aria-modal="false"` on `role="alertdialog"` is also contradictory.
- `specs/bugs/review-3.md` (LOW): when block gaps are shown, both the "Dispatch anyway" panel and the main "Dispatch quest" button render simultaneously, presenting two undifferentiated affordances.

## Informational notes

- The fallback string `'Failed to dispatch quest'` on line 50 of `dispatch-button.tsx` is the kind of generic copy the task spec calls out ("no generic 'failed to dispatch'"). It is only reached when `err` is not an `Error` (which the current `api.ts` path makes essentially impossible — `ApiError extends Error` and `fetch` rejections are `Error` instances), so this is a defensive branch rather than a user-visible string. Worth replacing with a more concrete message in a future polish pass.
- The dispatch route runs `auditQuest` after checking `status !== 'idle'`. Two concurrent dispatches on the same quest could in theory both pass the idle check and race to write `status='active'`. SQLite serializes writes so no corruption occurs and the end state is still `active`; the second response would just overwrite the first audit. Not a defect for v1 single-user local-first usage but worth noting if multi-user dispatch is ever introduced.
- The unit test `'shows bypass confirm panel with countdown when "Dispatch anyway" is clicked'` reads the `(2s)` countdown label immediately after the click. Because `vi.useFakeTimers({ shouldAdvanceTime: true })` lets real time leak through, this assertion is theoretically flaky on a slow CI runner — if `waitFor` polling takes >1s the countdown will have already ticked. The race is unlikely in practice but the assertion would be more robust if it captured the immediate post-click frame inside an `act` or used `findByRole` with a regex like `/confirm dispatch \(\ds\)/i`.
- War Room's `useTownStore.setState({ setActiveModal: mockSetActiveModal })` in `beforeEach` mutates the shared store. The test cleanup does not restore the original action — only the mock function is cleared. This is fine in isolation but adds coupling to other tests that share the store. Consider snapshotting and restoring store state in the test setup.

## Verdict

**FAIL — 3 bugs filed (2 HIGH, 1 LOW).**

Two HIGH issues affect real-world UX (invisible success banner; broken focus management for the destructive bypass confirmation). One LOW issue is a small render-guard tweak. Once the HIGH issues are fixed, the dispatch flow should be ready to ship.
