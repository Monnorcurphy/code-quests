# BUG: Focus is lost when opening the returned-quest detail view

**Severity:** HIGH
**File(s):** `packages/client/src/features/hall-of-returns.tsx`

## Problem

`HallOfReturns` toggles between a list view (Close button + quest cards) and a detail view (Back button + log) via the `selectedQuest` state. When the user clicks a card:

1. The card `<button>` unmounts (it's inside the `else` branch of the ternary).
2. `ReturnedQuestDetail` mounts with a "← Back" button.
3. **Nothing moves focus** to the Back button — focus lands on `document.body`.

The existing `useEffect` only handles the inverse transition (detail → list):

```tsx
useEffect(() => {
  if (!selectedQuest) firstFocusableRef.current?.focus();
}, [selectedQuest]);
```

There is no corresponding effect when `selectedQuest` becomes non-null. A keyboard or screen-reader user is dropped at the body and must Tab blindly to reach the Back button — and during that gap the focus-trap can't function correctly because `document.activeElement` is outside the panel.

## Expected

Per `.claude/rules/state-management.md`, "Focus Management in Modals and Panels":
- When a modal/panel mounts, focus must move to the safest action.
- On dismiss, focus must return to the triggering element.

Per `.claude/rules/accessibility.md` rule 1 (keyboard accessible) and the spec's own focus-trap contract, focus must remain inside the panel and on a predictable element after a view transition.

The detail view is effectively a sub-panel mount. Focus should move to the Back button on open, and ideally back to the card that was clicked when the user returns to the list.

## Fix

1. Add an effect that focuses the Back button when `selectedQuest` becomes non-null. A common pattern is to give `ReturnedQuestDetail` a ref to its Back button and focus it on mount, or use an `autoFocus` prop on the Back button.
2. Optional but recommended: when returning to the list, focus the card that was just viewed instead of the Close button (track the last-selected quest id and `data-quest-id` on cards, then re-focus on transition back).
3. Add a unit test that:
   - Clicks a card.
   - Asserts that the Back button now has `document.activeElement`.
   - Clicks Back.
   - Asserts that focus returns to either the originating card or, at minimum, the Close button.
