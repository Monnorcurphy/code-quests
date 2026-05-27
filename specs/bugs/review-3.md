# BUG: BuildingModal still uses inline focus trap instead of useFocusTrap hook

**Severity:** LOW
**File(s):** `packages/client/src/routes/town.tsx`

## Problem

`BuildingModal` contains a 25-line inline focus trap (Tab cycling + Escape handling) that is functionally identical to the `useFocusTrap` hook extracted in task bran. The hook was extracted because GuildHall and TownSquare were the 3rd occurrence of the same pattern — but the 1st occurrence (BuildingModal) was not migrated.

This means two independent implementations now exist for the same behavior. If the Tab cycling logic or the Escape handler ever needs to change, it must be updated in two places, and they can silently diverge.

Additionally, `BuildingModal` retains `onCloseRef` + its sync effect solely to pass the callback into the inline keydown handler — boilerplate the hook was designed to eliminate.

## Expected

`code-quality.md` Rule of Three: after extracting a shared helper, all occurrences should use it. The hook exists precisely for `BuildingModal`'s pattern.

## Fix

Refactor `BuildingModal` to use `useFocusTrap`:

```tsx
function BuildingModal({ building, onClose }: BuildingModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useFocusTrap(onClose);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={panelRef} className="modal-panel">
        <h2 id="modal-title" className="modal-title">
          {building.name}
        </h2>
        <p className="modal-body">Coming in Phase 2 — Phaser scene</p>
        <button ref={closeRef} className="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
```

Remove the `onCloseRef`, its sync effect, the entire 25-line keydown handler, and the `panelRef` declaration — all replaced by `useFocusTrap(onClose)`. Add `import { useFocusTrap } from '../lib/use-focus-trap';`.
