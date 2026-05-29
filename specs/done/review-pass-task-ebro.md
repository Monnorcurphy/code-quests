# Review Pass — Task ebro

**Task:** Forge skill from a monster — manual flow (US-15)
**Branch:** feature/ebro
**Parent:** feature/chattahoochee
**Verdict:** PASS (0 bugs filed)

## Summary of checks performed

- Read pre-computed diff covering all 7 changed files (forge-skill-modal.tsx, forge-skill-modal.test.tsx, monster-detail.tsx, promote-nemesis-modal.tsx, skills-tab.tsx, features.css, progress.md).
- Read full source of forge-skill-modal.tsx, monster-detail.tsx, skills-tab.tsx, promote-nemesis-modal.tsx, and forge-skill-modal.test.tsx.
- Verified test pyramid: 15 new Vitest tests under `__tests__/forge-skill-modal.test.tsx`, all required scenarios from the spec covered (renders with seeded type, empty name → inline error, no type selected → submit disabled, happy path invalidates `['skills']` query and closes, field-specific error on `field: 'name'`).
- Ran client lint (`pnpm -F client lint`) — 0 errors.
- Ran client typecheck (`pnpm -F client typecheck`) — 0 errors.
- Ran client build (`pnpm -F client build`) — successful.
- Ran client tests (`pnpm -F client test`) — 951 / 951 passed.
- Ran server tests — 515 / 515 passed.
- Grepped for hardcoded secrets (`sk-`, `AKIA`, `password=`, `api_key=`) across all changed files — none found.
- Verified accessibility:
  - Modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby="forge-modal-title"`.
  - All form inputs have visible `<label>` (no placeholder-only labels).
  - Required field marked via `aria-required="true"`, asterisk via `aria-hidden="true"` span.
  - Validation errors use `role="alert"` and `aria-describedby` linkage with `aria-invalid`.
  - Success message uses `role="status"` + `aria-live="polite"`.
  - Submit error uses `role="alert"` + `aria-live="assertive"`.
  - Form-actions has `aria-busy={isSubmitting}` for screen-reader busy state.
  - Focus trap via `useFocusTrap` (ESC closes + Tab cycle), focus returns to trigger button on close, initial focus moves to Cancel (safe action).
  - Reduced-motion respected in `.forge-skill-modal` styling (no animations introduced; uses existing tokens).
- Verified cross-boundary contract:
  - Client posts `{ name, monsterTypeIds, implementation }`. Server route at `packages/server/src/routes/skills.ts:62` validates the body with the same shared `ForgeSkillSchema` (`packages/shared/src/skill-actions.ts:3`).
  - Schema: `name: z.string().trim().min(1).max(80)`, `monsterTypeIds: z.array(z.string()).min(1)`, `implementation: z.string().max(2000).default('')`. Client UI enforces `maxLength={80}` on name and `maxLength={2000}` on the implementation textarea; submit button is disabled until name is non-empty and at least one type is selected. The client always sends `implementation: ''` when blank, which the server schema accepts via `.default('')`. ✓
  - Server route also imports `ForgeSkillSchema` from the shared package — single source of truth confirmed.
- Verified input validation rules:
  - Constrain inputs over outputs: monster-types use checkboxes; implementation is a textarea with `maxLength=2000`; name has `maxLength=80`.
  - Per-field validation: `validateName` runs onBlur and inside `handleSubmit`; error clears as user types.
  - Errors name the field and the fix (e.g., "Name is required.", "Name must be 80 characters or fewer.").
  - Server-side field error (`field: 'name'`) is mapped to the inline `nameError` slot rather than the generic submit error banner.
- Verified UX feedback:
  - Three states on submit (loading: disabled + "Forging…", success: auto-dismiss 3s, error: persistent).
  - Form populated after error (`setIsSubmitting(false)` in catch path, no field reset).
  - Trigger focus restored on dismiss / cancel / overlay-click / ESC.
- Verified state-management conventions:
  - `useFocusTrap` registers a single document-level keydown listener with stable cleanup; latest `onEscape` is captured via a ref so the listener does not stack with re-renders.
  - `useQueryClient` used inline (no component-level event listeners required for this flow).
  - TanStack Query cache invalidated with `queryClient.invalidateQueries({ queryKey: ['skills'] })` on success — skills list refreshes without manual reload.
- Verified rule compliance (CLAUDE.md + factory rules):
  - File size: forge-skill-modal.tsx is 219 lines (under 300-line component limit).
  - TypeScript strict, no `any`, no `console.log` in production source. Test file uses `vi.useFakeTimers` to test the 3-second auto-dismiss timing (matches `ux-feedback.md` requirement).
  - No silent error swallowing — catch branch surfaces the error either as inline field error or banner.
  - No secrets, no `eval`, no telemetry, no localStorage misuse.

## Spec mapping

- Modal can be opened from monster detail and Skills tab empty state ✓ (`monster-detail.tsx:160-168`, `skills-tab.tsx:110-117`).
- ESC and overlay click close + return focus ✓ (`useFocusTrap` + `handleClose` + backdrop onClick guarded by `e.target === e.currentTarget`).
- Newly forged skill appears in Skills tab without manual refresh ✓ (cache invalidation on success).
- Forge respects `ForgeSkillSchema` on client + server ✓ (single shared schema).
- Toast on monster detail post-forge: "Skill 'X' added to your guild's library." ✓ (`monster-detail.tsx:81`, auto-clears after 4s).

## INFORMATIONAL notes (not bugs)

- **Duplicate import line** in `forge-skill-modal.tsx:2-3`: `useQueryClient` and `useQuery` are imported with two separate `import` statements from `@tanstack/react-query`. Could be consolidated to one line — cosmetic only, no functional impact.
- **Auto-close timer not cleared on unmount**: the `setTimeout(... 3000)` inside `handleSubmit` is not cancelled if the user dismisses the modal via ESC during the success window. Practically benign because the modal is the only consumer of the timer's effects and `triggerRef.current?.focus()` / `onSuccess` / `onClose` are all safe to invoke against an already-dismissed modal (parent's `setShow*ForgeModal(false)` becomes a no-op, the toast still meaningfully confirms the skill was forged). Could be tightened with a ref-tracked timer + cleanup in a future task.
- **Forge button on Skills tab is only shown in the empty `active` state** — matches the task spec exactly, but once a user has at least one active skill they have to navigate via monster detail to forge another. Future task may expose a persistent Forge button in the Skills tab header.
- **`forge-types-empty` copy says "Loading monster types…" even when the list is genuinely empty post-load**: not currently reachable because monster types are seeded at install, but future task could distinguish the two states.
- **No integration tests for the two new entry points** (the "⚒ Forge Skill" button on monster-detail and the "⚒ Forge a Skill" button in the Skills tab empty state). The modal itself is well-tested; wiring is exercised manually. Spec did not require it.

## Verdict

**PASS — 0 bugs filed.**

All acceptance criteria from the task spec are met. Lint, typecheck, build, and full test suites (client 951/951, server 515/515) are green. Cross-boundary schema is a single shared module, accessibility primitives are in place, and the UX feedback / focus-management requirements are honored.
