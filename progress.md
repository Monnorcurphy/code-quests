# Progress — Phase 10

Previous task progress archived to metrics/progress-before-chattahoochee.md

## chattahoochee — Library Skills tab (active list + candidates panel)

**Status:** Complete

**What was built:**
- `packages/client/src/features/library/skill-candidate-card.tsx` — parchment card for one candidate skill; states: idle, confirming (inline form), confirming-loading, dismissing, success. Success toast auto-dismisses via 3s setTimeout that calls `queryClient.invalidateQueries(['skills'])`.
- `packages/client/src/features/library/skills-tab.tsx` — Skills tab component; queries `['skills']` and `['monster-types']`, renders Skill Candidates (top) and Unlocked Skills table (bottom), both with empty states. Includes `RetireButton` sub-component.
- `packages/client/src/features/library.tsx` — replaced placeholder `<p>` with `<SkillsTab />`. Added `['skills']` query to derive `candidateCount`; Skills tab button shows a red dot indicator and updated `aria-label` when candidates ≥ 1.
- `packages/client/src/features/library/__tests__/skills-tab.test.tsx` — 18 Vitest tests covering empty states, candidate confirm/dismiss flows (with vi.useFakeTimers for the 3s dismiss), inline name validation, error states, active-skill retire, and axe-core accessibility checks.
- Updated `packages/client/src/__tests__/library.test.tsx` to mock `api.skills` and update the stale Skills-tab placeholder assertion.
- Added CSS for all new components to `packages/client/src/styles/features.css`.

**Verify:** 936 client tests pass, 515 server tests pass, typecheck and lint clean.
