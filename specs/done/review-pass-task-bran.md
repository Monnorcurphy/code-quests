# Review Pass — Task bran (Adventurer recruit flow + roster)

**Branch:** `feature/bran`
**Reviewed against:** factory rules (constitution, security, accessibility, input-validation, ux-feedback, common-findings, review-contract) + task spec in `metrics/task-bran-context.md`.

## Checks performed

- Read every new/modified source file once (recruit-modal, roster, guild-hall, town-square, town route, api lib, use-focus-trap, features.css, plus test files).
- Verified `pnpm -r test` (94 tests pass: 27 client + 67 server), `pnpm typecheck` (clean), `pnpm lint` (clean).
- Grepped for secrets (`sk-`, `AKIA`, `api_key`, `password=`, `secret`) — none found.
- Grepped for `console.*` in production source — none found (no-console: error in `.eslintrc.cjs`).
- **Cross-boundary validation:**
  - DB CHECK in `001_init.sql`: `class IN ('champion','ranger','scout','rogue','apprentice')`.
  - Shared `AdventurerClassSchema` (`packages/shared/src/adventurer.ts`): same 5 values.
  - Server `CreateAdventurerSchema` (`packages/server/src/routes/adventurers.ts`) imports `AdventurerClassSchema` → matches DB.
  - Frontend `CLASSES` array in `recruit-modal.tsx` lists the same 5 values; `<select>` enforces the constraint at the UI.
  - Verdict: enum values match end-to-end.
- **Input validation** (rules/input-validation.md): class is a `<select>` (constrained), name has onBlur + onSubmit Zod validation with field-named errors, `maxLength=80`, `.trim()` applied. ✓
- **UX feedback states** (rules/ux-feedback.md): loading (button disabled, label "Recruiting…", `aria-busy`), success (`role="status"`, auto-dismiss after 3 s via `setTimeout`), error (persists, `role="alert"`, `aria-live="assertive"`). ✓
- **Accessibility:** form has `<label htmlFor>` for both fields, `aria-describedby`/`aria-invalid` on the name input, Escape closes the modal, focus trap via `useFocusTrap`, focus returns to recruit button after dismiss (`useEffect(() => { if (!showRecruit) recruitBtnRef.current?.focus(); }, [showRecruit])`).
- **Optimistic insert + rollback:** `onMutate` adds optimistic row, `onSuccess` swaps in real row, `onError` restores `prev` snapshot. ✓
- **Modal navigation:** `routes/town.tsx` correctly branches Guild Hall and Town Square to their bespoke views and falls through to the generic `BuildingModal` for the other six buildings.
- **CSS contrast:** new colors (`#2e7d32` on `#e8f5e9`, `#c62828` on `#fce4ec`, `--color-text-secondary #5a4e3a` on parchment, `--color-stone #6b6b5e` on parchment) all clear WCAG 4.5:1 for normal text by inspection.

## Bugs filed

| # | Severity | File | Title |
|---|----------|------|-------|
| 1 | HIGH | review-1.md | Recruit/roster API calls fail in browser — no CORS on server, no Vite proxy |

## INFORMATIONAL notes (not blocking)

- **Optimistic rollback is not directly asserted in tests.** `recruit-modal.test.tsx` covers the server-error and field-named-error paths (which exercise the `onError` handler), but no test snapshots `queryClient.getQueryData(['adventurers'])` before/after to confirm the optimistic row is reverted. Spec only requires "tests cover the success state, validation error, and server error" — covered — so this is a follow-up, not a bug.
- **`useEffect(() => { onSuccessRef.current = onSuccess; });` (recruit-modal.tsx:29) and `callbackRef.current = onEscape;` (use-focus-trap.ts:11) omit a deps array.** Intentional ref-sync pattern; runs on every render but functionally correct. Adding `[onSuccess]` / `[onEscape]` would make the intent more obvious.
- **`(rawData as Adventurer[] | undefined)` casts in `guild-hall.tsx:22` and `town-square.tsx:22` are redundant** — TanStack Query already types `data` correctly from the `queryFn` return type. Remove the cast on a future cleanup pass.
- **`optimistic-${Date.now()}` ID generation** in `recruit-modal.tsx:40` is fine for human-paced clicks but would collide if two submissions fired within 1 ms. Not a real-world risk; noted for completeness.
- **`autoFocus` on the name input** in `recruit-modal.tsx:140` is appropriate for a modal context but is generally something to avoid sprinkling across the app — keep it confined to modal-style flows.

## Verdict

**FAIL** — 1 HIGH bug filed (review-1.md). The recruit flow's UI, validation, accessibility, optimistic state, and tests are all solid; the blocking issue is infrastructure (CORS/proxy missing) that prevents the feature from working in a real browser despite passing every offline check.
