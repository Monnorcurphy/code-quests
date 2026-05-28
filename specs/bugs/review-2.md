# BUG: Dialog `aria-labelledby="settings-title"` dangles when Credits view is open

**Severity:** HIGH
**File(s):** `packages/client/src/components/settings-button.tsx`, `packages/client/src/features/credits.tsx`

## Problem

The settings modal sets `aria-labelledby="settings-title"` on its
`role="dialog"` backdrop:

```tsx
<div className="modal-backdrop" role="dialog" aria-modal="true"
     aria-labelledby="settings-title" ...>
  <div ref={panelRef} className="modal-panel settings-panel">
    {creditsOpen ? (
      <Credits onBack={...} />          // <-- no element with id="settings-title"
    ) : (
      <>
        <h2 id="settings-title" ...>Settings</h2>
        ...
      </>
    )}
  </div>
</div>
```

When `creditsOpen` is `true`, the `<h2 id="settings-title">` is unmounted but
the dialog's `aria-labelledby` still references it. The dialog now has **no
accessible name** — screen readers announce only "dialog" with no label.
This is a WCAG 4.1.2 (Name, Role, Value) failure and is normally caught by
axe-core's `aria-valid-attr-value` rule. The capstone E2E spec runs axe-core
against `[role="dialog"]` while credits is open (lines 192–204 of
`phase-8-audio-capstone.spec.ts`), so this likely also fails the
zero-violations gate when the E2E suite is actually run (`pnpm test` only
runs vitest; Playwright is `pnpm test:e2e`).

Additionally, focus management breaks across the view switch:
- `SettingsPanel` mounts and focuses `closeRef.current` (the Close button).
- User clicks "Credits" → the Close button unmounts. `Credits` has no
  `useEffect` to move focus to its Back button.
- The previously-focused Credits button also unmounts, so DOM focus falls
  back to `<body>`. Keyboard users lose their place.

## Expected

Per `rules/accessibility.md`:
> "Use where semantic HTML isn't enough: aria-label, aria-current, aria-live.
> ARIA supplements, not replaces, semantic HTML."

Per `rules/state-management.md` "Focus Management in Modals and Panels":
> "When a modal, confirmation dialog, or slide-out panel mounts: Focus must
> move to the safest action ... Focus must NOT re-snap on every parent
> re-render — use a mount-only effect"

The dialog must have a valid accessible name in every state, and focus must
move sensibly when the user switches between Settings and Credits views.

## Fix

1. Give the Credits view its own heading id and update the dialog label
   accordingly. Either:
   - Render the Credits `<h3 id="credits-title">Audio Credits</h3>` and switch
     the dialog's `aria-labelledby` value based on `creditsOpen`, or
   - Promote the credits heading to `<h2 id="settings-title">Audio Credits</h2>`
     (re-using the same id) so the dialog stays labelled.
2. Add a mount-only `useEffect` in `Credits` that focuses the Back button
   so keyboard users land on a sensible target when they open Credits, and
   focus the Credits button (or Close) when the user clicks Back.
3. Ensure the capstone Playwright suite actually runs in CI — the existing
   axe-core assertion will then guard against regressions.
