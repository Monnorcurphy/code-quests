# BUG: TourOverlay does not restore focus on dismiss

**Severity:** HIGH
**File(s):** packages/client/src/features/tour/tour-overlay.tsx,
packages/client/src/features/town-square/showcase-button.tsx

## Problem

`TourOverlay` is opened by the "Start Showcase Demo" button (via
`startTour()` in `ShowcaseButton`). It is `role="dialog"` /
`aria-modal="true"`, and the overlay manages focus on mount (it focuses
the Next or Back button). But when the user dismisses the tour
(Escape, Close button, or "Finish Tour"), the overlay simply unmounts
and focus drops back to `<body>`. The triggering button is lost.

This is also true for any future caller of `startTour()` — there is no
mechanism to remember and restore the previously focused element.

## Expected

Per `.claude/rules/state-management.md` §"Focus Management in Modals and
Panels":

> 3. On dismiss, focus must return to the triggering element

After the tour overlay unmounts, focus must return to whatever element
was focused at the moment the tour started (typically the "Start
Showcase Demo" button). Otherwise keyboard users are dropped into a
context-free `<body>` focus and must Tab from scratch to find their
place.

## Fix

In `TourOverlayContent`:
1. On mount, capture `document.activeElement as HTMLElement | null` into
   a ref (the "trigger" element).
2. On unmount (cleanup of a `useEffect` with `[]` deps), call
   `trigger?.focus()` if the trigger is still in the DOM.

Add a test that uses `userEvent` (or `fireEvent.keyDown(document.body,
{ key: 'Escape' })`) to verify focus returns to the trigger element
after the tour exits.
