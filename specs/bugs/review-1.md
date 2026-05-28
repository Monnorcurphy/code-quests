# BUG: PromoteNemesisModal lacks focus management — no initial focus, no focus trap, no focus return

**Severity:** HIGH
**File(s):** packages/client/src/features/library/monster-detail.tsx

## Problem

The new `PromoteNemesisModal` (lines 53–140 of `monster-detail.tsx`) is rendered with
`role="dialog"` and `aria-modal="true"` but does not implement the focus management
contract required by both `.claude/rules/accessibility.md` (#1, #2, #10) and
`.claude/rules/state-management.md` ("Focus Management in Modals and Panels").

Specifically:

1. **No initial focus is moved into the modal on mount.** A `cancelRef` is declared
   (line 56) but never `.focus()`ed via a mount effect. When the modal opens, keyboard
   focus stays on the underlying "Mark as Nemesis" trigger button (now hidden behind
   the modal). Tab from the user's current position can wander outside the modal.

2. **No focus trap.** The component does not call `useFocusTrap` (the project-wide
   helper used by `Library`, `RecruitPanel`, `QuestBoardPanel`, etc.). Because the
   modal is rendered as a sibling inside the Library tree (no React Portal), Tab can
   move focus to the underlying Bestiary table rows / Library tabs that sit beneath
   the modal in the DOM. That violates the modal contract (`aria-modal="true"` claims
   focus is trapped).

3. **No focus return on close.** Both the Cancel path (line 122 `onClose`) and the
   success path (lines 163–168 `handlePromoteSuccess`) drop `showPromoteModal` to
   `false` without restoring focus to the "Mark as Nemesis" trigger button. The user
   is left with focus on `document.body` (or whichever element React picks).

This is the exact pattern enumerated in `state-management.md` → "Focus Management in
Modals and Panels":
> 1. Focus must move to the safest action (Cancel button for destructive confirms)
> 2. Focus must be trapped inside the modal (Tab cycles within, not escaping)
> 3. On dismiss, focus must return to the triggering element

Axe-core does not catch any of these (it inspects ARIA / contrast, not focus
behavior), which is why the existing E2E `no axe violations` test in
`phase-6-capstone.spec.ts` passes despite the bug.

## Expected

Per `.claude/rules/accessibility.md` and `.claude/rules/state-management.md`:

- On mount, focus moves to the Cancel button (this is a destructive-confirm pattern).
- A focus trap (`useFocusTrap`) is installed so Tab cycles only within the promote
  modal's panel.
- On dismiss (Cancel or successful submit), focus returns to the "Mark as Nemesis"
  trigger button in `MonsterDetail`.

## Fix

In `monster-detail.tsx`:

1. Add a ref to the "Mark as Nemesis" trigger button in `MonsterDetail` and pass it
   into `PromoteNemesisModal` as a `triggerRef` prop.
2. In `PromoteNemesisModal`:
   - Replace the manual `<div className="modal-backdrop" role="dialog" ...>` panel
     with a `useFocusTrap(onClose)` panel ref (mirror the pattern in
     `town-square.tsx` `RecruitPanel`).
   - Add a mount-only `useEffect` that calls `cancelRef.current?.focus()` exactly
     once.
   - In `onClose` and `onSuccess`, restore focus by calling
     `triggerRef.current?.focus()` after unmount (use the existing
     `useFocusTrap`'s onClose hook or wrap the close calls in `MonsterDetail`).
3. Add a unit test in `bestiary.test.tsx` or a sibling file:
   - Open monster detail → click "Mark as Nemesis" → assert
     `document.activeElement` is the Cancel button.
   - Press Tab → assert focus stays on the Submit button (not the bestiary table).
   - Press Escape or click Cancel → assert `document.activeElement` is the
     "Mark as Nemesis" trigger.
