# BUG: Focus does not move into Oracle/Tavern/Library after async quest load

**Severity:** LOW
**File(s):** packages/client/src/features/oracle.tsx, packages/client/src/features/tavern.tsx, packages/client/src/features/library.tsx

## Problem

Each of Oracle, Tavern, and Library has the same focus effect (oracle.tsx lines 114-121 is representative):

```ts
useEffect(() => {
  const panel = panelRef.current;
  if (!panel) return;
  const first = panel.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled])',
  );
  first?.focus();
}, [panelRef]);
```

`panelRef` is a stable ref, so the effect runs exactly once at mount. On mount, the dialog typically renders the **loading state** (no inputs, no buttons — just `<p>Loading quest…</p>`). `querySelector` returns `null`, `first?.focus()` is a no-op.

When `useQuery` resolves and the form renders (inputs + Save + Back buttons), the effect does not re-run. Focus stays on whatever element was focused before the modal opened — typically on a chip button in the now-unmounted War Room, which means focus falls back to `<body>`.

Net result for a keyboard / screen-reader user: opening Oracle (or Tavern / Library) from a War Room chip lands them outside the dialog. They have to Tab back into it to interact, and a screen reader does not announce the dialog content automatically.

## Expected

Per `.claude/rules/accessibility.md` rule 1 ("Keyboard accessible") and standard ARIA dialog guidance: when a dialog opens, focus must move into it. If the dialog defers rendering its interactive controls behind a loading state, focus must land in the dialog as soon as those controls appear.

## Fix

In each of `oracle.tsx`, `tavern.tsx`, `library.tsx`, change the focus-on-mount effect to also re-run once when the quest loads. The simplest fix: add a state flag (e.g., `focusedAfterLoad`) and depend on `quest` so the effect can pick up the first input after data arrives:

```ts
const focusedRef = useRef(false);
useEffect(() => {
  if (focusedRef.current) return;
  const panel = panelRef.current;
  if (!panel) return;
  const first = panel.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
  );
  if (first) {
    first.focus();
    focusedRef.current = true;
  }
}, [panelRef, quest]);
```

Add a unit test that verifies the first input has focus after the quest mock resolves.
