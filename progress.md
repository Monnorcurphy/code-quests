# Progress — Phase 10

Previous task progress archived to metrics/progress-before-ebro.md

## task-ebro — Forge skill from a monster (manual flow)

- Created `packages/client/src/features/library/forge-skill-modal.tsx` — modal with name input, multi-select monster type checkboxes, implementation textarea, focus trap, overlay-click close, ESC close, loading/success/error states, 3s auto-dismiss on success.
- Created `packages/client/src/features/library/promote-nemesis-modal.tsx` — extracted existing inline `PromoteNemesisModal` from monster-detail.tsx to keep component under 300-line limit.
- Extended `packages/client/src/features/library/monster-detail.tsx` — added "⚒ Forge Skill" secondary button next to "Mark as Nemesis", shows toast on forge success.
- Extended `packages/client/src/features/library/skills-tab.tsx` — empty active skills state now includes "⚒ Forge a Skill" button that opens ForgeSkillModal without preselection.
- Added CSS for forge modal, type checkboxes, textarea, form-error, skills-empty-state to `features.css`.
- Created `packages/client/src/features/library/__tests__/forge-skill-modal.test.tsx` — 14 tests covering rendering, validation, happy path (query invalidation, auto-dismiss), error handling (generic + field-specific), and dismiss flows. All 951 tests pass.
- Typecheck and lint: clean.
