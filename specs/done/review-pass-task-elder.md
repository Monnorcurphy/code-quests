# Review pass — TASK elder (Quest remedy actions: re-post / retire / split)

## Scope reviewed
- `packages/client/src/features/hall-of-returns/actions/action-bar.tsx`
- `packages/client/src/features/hall-of-returns/actions/repost-dialog.tsx`
- `packages/client/src/features/hall-of-returns/actions/retire-dialog.tsx`
- `packages/client/src/features/hall-of-returns/actions/split-dialog.tsx`
- `packages/client/src/features/hall-of-returns/actions/__tests__/*.test.tsx`
- `packages/client/src/features/hall-of-returns/post-mortem.tsx` (integration point)
- `packages/client/src/lib/api.ts` (new `RepostResultSchema` / `SplitResultSchema`, `api.quests.repost/retire/split`)
- Cross-boundary check: `packages/server/src/routes/quest-actions.ts` (the real receiving side)

## Checks performed
- Read the pre-computed diff in full
- Ran `pnpm --filter @code-quests/client test` (910 passed)
- Ran `pnpm --filter @code-quests/client typecheck` (clean)
- Ran `pnpm --filter @code-quests/client lint` (clean)
- Grepped action-source for `console.*`/`debugger` (none)
- Grepped action-source for banned Tailwind contrast classes (`text-{gray,neutral,slate,zinc}-{100..400}`, `placeholder-gray-…`) — none
- Cross-boundary contract: parsed a representative `rowToApi` response (full quest object) against the new `RepostResultSchema` / `SplitResultSchema` with zod 3.25.76 — both rejected as expected (see review-1.md)
- Verified backend `POST /quests/:id/actions/repost`, `/retire`, `/split` response shapes in `packages/server/src/routes/quest-actions.ts`
- Verified focus-management contract (Escape closes, focus returns to trigger on unmount, retire dialog focuses Cancel)
- Verified input-validation rules: re-post disables submit when all ACs cleared; split disables submit until ≥ 2 valid children

## Bugs filed
- `specs/bugs/review-1.md` — **CRITICAL** Client `RepostResultSchema` / `SplitResultSchema` reject the actual server response; runtime `ZodError` will surface as a generic "Could not re-post / split quest" toast and the linkage never renders. Tests don't catch it because each dialog test mocks `api.quests.*` and returns the expected client shape directly.
- `specs/bugs/review-2.md` — **HIGH** The "Re-posted as <title>" and "Split into …" links all point to `/town/war-room` with no `selectedQuestId` wiring, and use raw `<a href>` instead of `Link`/`useNavigate`. Spec says "links to the new quest" — current behavior is "navigates to the building".
- `specs/bugs/review-3.md` — **LOW** `ActionBar.showToast` schedules a `setTimeout` with no cleanup on unmount or supersession; will null-out a newer toast and call `setState` on an unmounted component.

## Informational notes (not filed as bugs)
- `recommendation: 'retry'` is mapped to "Re-post Quest" recommended. Spec doesn't define this mapping explicitly; the choice is reasonable (a retry = repost without edits) but worth documenting in the post-mortem rules so a future builder doesn't second-guess it.
- `recommendation: 'level_up_first'` has no recommended-action target. That's correct (none of the three actions match), but the panel offers no affordance for the recommended path. Future task could surface a "Go to Guild Hall to level up" hint.
- The dialog tests don't run `axe-core` checks even though the spec mentions "Axe-core: zero violations". Other unit-test files in the repo also omit per-component axe assertions — the project-wide accessibility check lives in Playwright E2E (`tests/e2e/*-a11y.spec.ts`). Consistent with house style, but a `jest-axe` smoke test on each dialog would be cheap insurance.
- `renderActionBar` in `action-bar.test.tsx` uses a conditional `infer` type expression to derive `FailureSummaryRecommendation | undefined`. Functionally fine; a direct `recommendation: FailureSummaryRecommendation | undefined` is more readable.
- Dialogs use inline `style={{ position: 'fixed', inset: 0, … }}` for the backdrop instead of a CSS class. Consistent with `retire-dialog`/`repost-dialog`/`split-dialog`; would be cleaner in `features.css`.
- `RepostDialog` and `SplitDialog` tests cover Escape + button close but don't cover backdrop click (RetireDialog does). Coverage gap, not a bug.

## Verdict
**FAIL — 3 bugs filed (1 CRITICAL, 1 HIGH, 1 LOW).**

The CRITICAL boundary bug is the load-bearing one: until it's fixed, the entire re-post and split flows look broken to the user even when the server succeeded. Fix in `review-1.md` is small (re-shape the client schemas or remap inside the dialog), but it must land before this task can be marked done.
