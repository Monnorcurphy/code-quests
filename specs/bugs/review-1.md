# BUG: Modal lacks focus trap — Tab escapes to background buttons

**Severity:** HIGH
**File(s):** `packages/client/src/routes/town.tsx`

## Problem

`BuildingModal` does not trap keyboard focus inside the dialog. Focus is moved to the Close button on mount, but pressing `Tab` (or `Shift+Tab`) immediately moves focus out of the modal back into the underlying 8 building buttons (still in the document and focusable). This breaks the standard modal contract for keyboard / screen-reader users: they can interact with the supposedly-blocked background while the dialog is open.

Repro:
1. Click any building (e.g. "Oracle") — modal opens, focus on "Close".
2. Press `Tab` — focus moves OFF the dialog and onto a background "Enter <building>" button.
3. Pressing `Enter` activates that background button, layering modals / corrupting state.

## Expected

Per `rules/domain/frontend/state-management-conventions.md` ("Focus Management in Modals and Panels"):

> 2. Focus must be trapped inside the modal (Tab cycles within, not escaping)

…and per the task spec acceptance criteria ("Keyboard nav works: Tab through buildings, Enter to open, Escape to close") combined with the universal accessibility rule that modals must not leak focus.

With only a single focusable element (Close), Tab and Shift+Tab should both keep focus on that button (or on any other focusable element added later) — never on background content.

## Fix

In `BuildingModal`, add a `keydown` handler for `Tab` that:
- Computes the list of focusable elements inside `modal-panel` (querySelector for `button, [href], input, [tabindex]:not([tabindex="-1"])`).
- If focus is on the last element and Tab is pressed (without Shift), move focus to the first; if on the first and Shift+Tab is pressed, move to the last.
- `e.preventDefault()` in both cases.

Also add an `aria-hidden="true"` (or `inert`) to the main building grid (or wrap the page content in a container so it can be marked inert) while the modal is open, so assistive technology does not announce the background buttons.

Add a regression test in `packages/client/src/__tests__/town.test.tsx`:

```tsx
it('traps focus inside the modal — Tab cycles to Close', async () => {
  const user = userEvent.setup();
  renderTown();
  await user.click(screen.getByRole('button', { name: /Oracle/i }));
  const close = screen.getByRole('button', { name: 'Close' });
  expect(close).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus(); // still inside modal
});
```
