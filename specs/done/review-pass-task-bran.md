# Review Pass — Task bran

**Task:** Adventurer recruit flow + roster  
**Branch:** feature/bran  
**Reviewer:** Adversarial reviewer agent  
**Date:** 2026-05-26

## Summary

3 bugs filed (1 HIGH, 2 LOW). No CRITICAL bugs. No data loss risk, no security issues, no failing tests.

## Bugs Filed

| # | Severity | Title |
|---|----------|-------|
| review-1 | HIGH | Missing aria-live loading state announcement in RecruitModal |
| review-2 | LOW | `onClick={onCancelRef.current}` — unnecessary ref indirection for click handler |
| review-3 | LOW | `BuildingModal` still uses inline focus trap instead of `useFocusTrap` hook |

## What Was Checked

### Cross-boundary validation (mandatory)

- DB migration `001_init.sql` CHECK: `class IN ('champion', 'ranger', 'scout', 'rogue', 'apprentice')`
- Shared `AdventurerClassSchema`: `z.enum(['champion', 'ranger', 'scout', 'rogue', 'apprentice'])`
- UI `CLASSES` array in `recruit-modal.tsx`: same 5 values in same order
- **Result: ✓ all three match — no boundary mismatch**

### Contrast (WCAG AA 4.5:1)

- `--color-stone` (#6b6b5e) on `--color-parchment` (#f5f0e8): ≈ 4.76:1 ✓ (`.roster-record` at 0.85rem)
- `--color-text-secondary` (#5a4e3a) on parchment: ≈ 6.43:1 ✓ (roster-class, roster-status, headings)
- `#c62828` on parchment: > 7:1 ✓ (field-error, recruit-error text)
- `#2e7d32` on `#e8f5e9`: passes ✓ (recruit-success text)
- **Result: ✓ all measured colors pass 4.5:1**

### Accessibility

- All building modals have `role="dialog"`, `aria-modal="true"`, unique `aria-labelledby` ✓
- Focus snaps to first interactive element on modal open ✓
- Escape closes modal (via `useFocusTrap` in GuildHall/TownSquare; inline in BuildingModal) ✓
- Focus returns to trigger button on close ✓
- Form inputs have visible `<label>` elements ✓
- Error states use `role="alert"` or `aria-live="assertive"` ✓
- Success state uses `role="status"` + `aria-live="polite"` ✓
- **Loading state announcement is missing → review-1 (HIGH)**
- `aria-invalid="true"` on invalid inputs ✓
- `aria-describedby` linking input to error message ✓
- `prefers-reduced-motion` respected for all button/card transitions ✓

### UX feedback rules

- 3-state submit button: idle → loading (disabled + text change) → success ✓
- Success auto-dismisses after 3s via `setTimeout` ✓
- Error persists until user action ✓
- `aria-live` loading announcement missing → review-1

### Code quality

- All new files within line limits (roster: 51, recruit-modal: 174, guild-hall: 80, town-square: 87, use-focus-trap: 40, features.css: 231) ✓
- No `console.log` in production code ✓
- No unused imports or variables ✓
- No `any` types ✓
- `useFocusTrap` extracted at Rule-of-Three trigger point ✓
- `BuildingModal` not migrated to hook → review-3 (LOW)

### Testing

- 94 tests passing (27 client + 67 server) ✓
- RecruitModal: 12 tests covering success, auto-dismiss, loading, validation, server error, field-named error, cancel, error persistence ✓
- Fake timers cleaned up in `afterEach` ✓
- Town tests updated with `QueryClientProvider` and API mocks ✓
- All 5 valid classes tested in select constraint test ✓

### Security

- No secrets in code ✓
- `modelId: 'default'` hardcoded for Phase 1 (correct — no model selection in this phase) ✓
- API keys: none present ✓

### Capstone coverage (mandatory — last task of Phase 1)

All Phase 1 features reachable from app entry point (`/town`):
- Town grid with 8 buildings ✓ (bodiam)
- Guild Hall: roster + recruit form with 3-state UX ✓ (bran)
- Town Square: roster side panel + recruit button ✓ (bran)
- 6 generic buildings: placeholder modal ✓ (bodiam)
- Server CRUD API: adventurers, quests, epics via REST ✓ (balmoral)

No dead-end screens found. A human can start the server, open `/town`, recruit an adventurer via Guild Hall or Town Square, and see them appear in the roster. Phase 1 is interactable.

## Informational Notes

- `useFocusTrap` is safe to use in both GuildHall and TownSquare concurrently (only one modal renders at a time, so no double `document.addEventListener` conflict in practice)
- On mount, both the panelRef snap-focus and the showRecruit effect try to focus the Recruit button — they agree on the target so there's no visible conflict
- Pressing Escape when the RecruitModal form is visible closes the entire modal (not just the form). The spec does not specify this behavior either way; it is consistent with standard dialog behavior
