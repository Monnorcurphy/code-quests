# Review Pass — TASK chattahoochee

**Task:** Library Skills tab — candidates panel + active skills list
**Branch:** feature/chattahoochee (parent: feature/cauvery)
**Verdict:** PASS (0 bugs filed)

## Checks performed

- Read the pre-computed diff (no `git diff` re-run).
- `pnpm typecheck` — passes across shared, server, client.
- `pnpm --filter @code-quests/client test` — 936 tests pass (66 files); the new `skills-tab.test.tsx` contributes 18 passing tests.
- `pnpm --filter @code-quests/client lint` — clean.
- `checks/contrast-classes.sh` — flagged hits exist (`hud-overlay.tsx`, `return-to-town-button.tsx`) but are pre-existing in files NOT touched by this diff.
- `checks/conditional-assertions.sh` — single hit is pre-existing in `hall-of-returns.spec.ts`, not in this diff.
- `checks/error-handling.sh` — server-side hits only, not in this diff.
- Secret scan (`sk-`, `AKIA`, `api_key`, `password=`) — none in the diff.
- Cross-boundary validation:
  - Skill status enum `('candidate' | 'active' | 'retired')` consistent across DB CHECK (`packages/server/src/db/migrations/001_init.sql:96-97`), shared `SkillStatusSchema` (`packages/shared/src/equipment.ts:11`), and client filters (`features/library/skills-tab.tsx:55-56`, `features/library.tsx:26`).
  - `ConfirmCandidateSchema` shape matches the payload built in `skill-candidate-card.tsx:58` (`{ name, implementation }`); both fields are optional/bounded server-side, frontend trims name and rejects empty before posting.
- Accessibility:
  - Tabbed regions retain `role="tab"` / `role="tabpanel"` from prior task.
  - Skills tab dot indicator is supplemented by an `aria-label` text change ("Skills — N candidate(s) pending"); not color-only.
  - Loading state uses `aria-live="polite"`; error state uses `role="alert"`; success state uses `role="status" aria-live="polite" aria-atomic="true"`.
  - All buttons have visible labels and `aria-label` where the visible text would be ambiguous (e.g., "Retire skill: Goblin Slayer", "Dismiss skill: Auto: Goblin (Linter)").
  - Form inputs have proper `<label htmlFor>` pairings; error link via `aria-describedby` + `aria-invalid`.
  - Three axe-core scans (empty, candidate visible, active skill visible) report zero violations.
- Capstone coverage: not applicable — `specs/phase-10/sequence.md` lists `indus` as the capstone (not chattahoochee).

## Spec compliance

- Skill Candidates section, parchment cards with sprite + name + hit count + Confirm/Dismiss buttons ✓ (`skill-candidate-card.tsx:99-155`).
- Inline confirm form with name override + optional implementation note ✓ (`skill-candidate-card.tsx:157-215`).
- Empty hint for zero candidates ("Slay the same kind of monster a few times…") ✓ (`skills-tab.tsx:83-86`).
- Unlocked Skills table with Name / Counters / Hit Count / Created / Retire ✓ (`skills-tab.tsx:106-147`).
- Empty hint for zero active skills pointing at Forge Skill entry ✓ (`skills-tab.tsx:100-103`).
- Tab dot indicator + aria-label change at candidateCount ≥ 1 ✓ (`library.tsx:72-79`).
- Three states (loading / success / error) on every async action; success auto-dismisses at 3s via `setTimeout` driven by `vi.useFakeTimers` in tests ✓ (`skill-candidate-card.tsx:26-31`, test at `skills-tab.test.tsx:198-223`).
- Test coverage matches the requested cases: empty states, render candidate, open form, empty-name inline error + API NOT called, dismiss removes card, retire active.

## INFORMATIONAL notes (no bugs filed)

1. **Name field validates on submit, not on blur.** The general input-validation rule prefers per-field validation as the user leaves an input. The spec explicitly says "submitting with empty name shows inline error," so the current behavior matches spec — noted, not filed. If desired later, an `onBlur` handler that surfaces "Skill name is required" earlier would improve discoverability for the rare case where a user clears the pre-filled value.
2. **No `maxLength` on name (80) or implementation (2000) inputs.** Server-side `ConfirmCandidateSchema` enforces both. Adding `maxLength={80}` / `maxLength={2000}` would constrain at the input boundary rather than rely on a server reject; minor.
3. **Focus management on inline form open/close.** When the user clicks "Confirm Skill" the triggering button is unmounted and focus falls to `<body>`. On Cancel the form is unmounted and focus is again lost. Spec doesn't call this out; the focus trap in `useFocusTrap` keeps focus inside the modal, but moving focus to the name input on open and back to the trigger on cancel would be a nicer keyboard experience.
4. **Type-chip fallback inconsistency.** When `monsterTypes` doesn't include a skill's type id, the candidate card shows only the first id (`skill.monsterTypeIds[0] ?? 'Unknown type'`) while the active-skills table maps over all ids. Defensive code, low impact, but inconsistent.

## Verdict

**PASS — 0 bugs filed.** Build, tests, lint, typecheck all green. The implementation meets the spec, satisfies accessibility requirements, and the cross-boundary contract holds end-to-end.
