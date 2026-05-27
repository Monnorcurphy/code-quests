# Review Pass — TASK emerald

**Branch:** feature/emerald
**Parent:** feature/diamond
**Verdict:** FAIL — 1 HIGH bug filed, 4 informational notes

## Summary of Checks

- Read the task spec (`metrics/task-emerald-context.md`) and the pre-computed diff.
- Read all new/modified files: `spec-audit-panel.tsx`, `gap-chip.tsx`, `quest-board.tsx`, `use-run-audit.ts`, `war-room.tsx`, `lib/api.ts`, `stores/town-store.ts`, `routes/quests.ts`, both test files, `styles/features.css`.
- Cross-referenced `SpecGapBuilding` enum (`packages/shared/src/spec-audit.ts`) against gap-chip labels and town-store scene-key mapping — both match the six enum variants exactly.
- Cross-referenced `spec_audit_json` column in `001_init.sql` — TEXT with no CHECK constraint; JSON validation lives in Zod. No boundary mismatch.
- Confirmed verification report (`metrics/verify-2026-05-27_09-52.txt`) shows build / test / typecheck / lint / smoke all PASS.
- Re-ran client tests (`pnpm --filter @code-quests/client test`) → 230 pass / 20 files.
- Re-ran server tests (`pnpm --filter @code-quests/server test`) → 105 pass / 8 files.
- Grepped for `console.*` in new client and server source files → none.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `api_key`, `password=`) → none.
- Verified `prefers-reduced-motion` handling: `.gap-chip-pulse` animation is disabled both via `@media (prefers-reduced-motion: reduce)` and the `[data-reduced-motion='true']` attribute selector.
- Verified `block` severity uses both colour AND text ("BLOCKING" label inline) per accessibility rule 3.
- Confirmed every gap-chip navigate button has an `aria-label` that includes the gap reason.

## Bugs Filed

- **review-1.md (HIGH)** — `POST /quests/:id/audit` catch block discards the caught error with no logging or comment. Violates `common-findings.md` §8 (silent error swallowing).

## Informational Notes

1. **Quest board button hides badge text from screen readers.** The new `quest-board-item-btn` has `aria-label={`View quest: ${quest.title}`}` on the outer `<button>`, then renders status, AC count, and audit badges as inner `<span>`s. Because the button has an explicit `aria-label`, ATs typically expose only that label as the accessible name — status / AC count / audit gap count is not announced when the button is focused. The information is still reachable inside the War Room detail view, so this isn't a hard regression (the old list items were non-interactive `<li>`s with no announced status either), but the new clickable affordance is a chance to do better. Consider expanding the `aria-label` to include status + audit summary, or splitting into a button + descriptive label pattern.

2. **No test for quest-board → War Room navigation.** The new `openQuestDetail` handler in `quest-board.tsx` calls `setSelectedQuestId` + `setActiveModal('draft')` but is not exercised in `quest-board.test.tsx`. Adding a click test would lock in the contract that the board can route into the War Room with a selected quest.

3. **No test for the 500 error path of `POST /quests/:id/audit`.** All existing server tests for the new endpoint exercise the happy path (or the 404 path for unknown ids). A test that mocks the audit adapter to throw and asserts the 500 response would harden the catch block (and would have surfaced the silent-swallow bug above).

4. **Redundant `as Quest` casts.** `war-room.tsx` line 31 (`questData as Quest | undefined`) and `quest-board.tsx` line 51 (`rawData as Quest[] | undefined`) cast values that are already inferred as `Quest`/`Quest[] | undefined` from the Zod-typed `api` methods. The accompanying comment ("fetchJson infers a slightly wider type due to Zod default handling") doesn't apply once `z.infer` is used on a schema with defaults — the inferred output type is `Quest`, not a wider type. The casts can be dropped to gain stricter type protection.

## Spec Coverage

All acceptance criteria in `metrics/task-emerald-context.md` are addressed:
- ✓ Clicking a gap chip calls `goToBuilding(slug)` which sets `currentScene` and emits door-enter, routing the Phaser scene (tested in `spec-audit-panel.test.tsx`).
- ✓ `block` severity uses both red border-left AND inline "BLOCKING" text label.
- ✓ `POST /quests/:id/audit` returns 200 with the persisted `SpecAudit`; `GET /quests/:id` returns the same audit (tested in `quests.test.ts`).
- ✓ `useRunAudit` invalidates `['quests']` and `['quest', id]` on success, so card badges update reactively.
- ✓ Every chip's button has an `aria-label` that includes the gap reason.
- ✓ Reduced-motion media query disables the chip pulse animation.
