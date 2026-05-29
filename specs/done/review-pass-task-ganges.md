# Review Pass — Task `ganges` (Custom monster type forge UI)

**Branch:** `feature/ganges` (parent `feature/ebro`)
**Verdict:** FAIL (2 bugs filed: 1 HIGH, 1 LOW)

## Checks performed

- Read pre-computed diff (6 files, +772/-15)
- Read task spec at `metrics/task-ganges-context.md`
- Read full implementation in `coin-monster-type-modal.tsx` (293 lines) and
  the Bestiary integration (`bestiary.tsx`)
- Read test file (`coin-monster-type-modal.test.tsx`, 22 tests)
- Read sprite manifest (`monster-sprites-manifest.ts`) and verified all 10
  `/assets/monsters/*.png` files exist on disk under
  `packages/client/public/assets/monsters/` (no stub icons)
- Read `useFocusTrap` to verify Escape + Tab wrap semantics
- Read shared `CreateMonsterTypeSchema` (1–60 char name, 1–5 difficulty int,
  1–500 char signature, custom `superRefine` regex check) and server
  `POST /monsters/types` handler to verify cross-boundary contract
- Read migration 009 (`CHECK(created_by IN ('system','user'))`) — server
  hardcodes `'user'`; client never sends `createdBy`. Boundary clean.
- Read new CSS rules (`bestiary-header`, `bestiary-coin-btn`,
  `coin-type-modal`, `sprite-picker-grid`, `sprite-option`) — all
  `prefers-reduced-motion` gated
- Greps: no `console.*` in modal source, no `sk-`/`AKIA`/`api_key`/`password=`,
  no banned `text-gray-{100..400}` / `text-neutral-{100..400}` /
  `text-slate-{100..400}` / `text-zinc-{100..400}` contrast classes
- Ran `pnpm --filter @code-quests/client test` → 973/973 pass (incl. 22 new)
- Ran `pnpm --filter @code-quests/client lint` → clean
- Ran `pnpm --filter @code-quests/client typecheck` → clean

## Bugs filed

| # | Severity | File | Title |
|---|----------|------|-------|
| 1 | HIGH | `__tests__/coin-monster-type-modal.test.tsx` | Missing axe-core test (acceptance criterion) |
| 2 | LOW | `coin-monster-type-modal.tsx` | 3s post-success setTimeout not cleared on unmount |

## INFORMATIONAL notes (not bugs, do not fix)

- **Submit button label during success state.** After a successful create,
  `isSubmitting` stays `true` for the 3-second toast window, so the submit
  button continues to read "Coining…" while the success message says
  "Type 'X' coined". Slightly contradictory but harmless — the modal closes
  before the user is likely to act on either. A future polish task could set
  `isSubmitting` to `false` and swap the label to "Coined ✓" on success.

- **Initial focus on Cancel button.** `useEffect` focuses Cancel on mount.
  This matches the project convention for modals (e.g. forge-skill modal),
  and `rules/state-management.md` says destructive confirms should focus the
  safest action. For a "create new" modal, focusing the Name input might
  be more discoverable, but the current behavior is consistent across the
  codebase. Defer to project convention.

- **`aria-pressed` for sprite picker.** The spec explicitly requests
  `aria-pressed="true"` for the selected sprite, and the implementation
  matches. A `<div role="radiogroup">` with `role="radio"` + `aria-checked`
  would be more semantically idiomatic for exclusive selection, but the
  implementation matches the spec exactly so this is not a bug.

- **Failure signature has no client-side max-length.** The shared Zod schema
  caps `failureSignature` at 500 chars and `name` at 60. The Name input
  has `maxLength={60}`; the signature input has no `maxLength` and no
  client-side length validator. Over-long input would fail at
  `CreateMonsterTypeSchema.parse(input)` inside `api.monsters.createType`
  and surface as a generic submit error rather than a per-field error.
  The spec does not require client-side length enforcement on the signature,
  but a future task could mirror the server cap with `maxLength={500}` and
  per-field guidance.

- **Bestiary JSX indentation.** Wrapping the existing bestiary div in a
  Fragment plus a new `bestiary-header` div left the inner scope-tab
  `<button>` children at the outer indentation level. Visual only; renders
  identically.

## Verdict

**FAIL — 2 bugs filed (1 HIGH, 1 LOW).** Re-review after fix round.
