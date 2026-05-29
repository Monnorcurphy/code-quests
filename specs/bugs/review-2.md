# BUG: Back-button focus effect runs before the back button mounts, so the back button never receives focus on initial page load
**Severity:** LOW
**File(s):** `packages/client/src/features/hall-of-returns/post-mortem.tsx`

## Problem

`PostMortem` declares an empty-dependency mount effect that attempts to move focus to the back button:

```tsx
// packages/client/src/features/hall-of-returns/post-mortem.tsx:52-58
const backRef = useRef<HTMLButtonElement>(null);
...
useEffect(() => {
  backRef.current?.focus();
}, []);
```

But the back button (with `ref={backRef}`) is only rendered in the success branch (line 86–94). On a fresh page load:

1. First render — `isLoading === true` → `LoadingState` is returned. The back button does **not** mount. `backRef.current` is `null`.
2. `useEffect` fires once; `backRef.current?.focus()` is a no-op.
3. The fetch resolves; component re-renders with the post-mortem body. The back button mounts and `backRef.current` is set.
4. `useEffect` does **not** run again (deps are `[]`), so `focus()` is never called against the now-mounted element.

Net effect: the developer's clearly-intended focus behaviour silently never happens on initial loads. (It will happen in the rare case where React Query has the data cached on mount, because then step 1 renders the success branch immediately.)

## Expected

Per `.claude/rules/state-management.md` ("Focus must NOT re-snap on every parent re-render — use a mount-only effect") and the general UX expectation that the back affordance is the safest action on this screen, focus should land on the back button once the page is interactable, exactly once, after data arrives.

## Fix

Tie the effect to the moment the back button actually mounts. Either:

- Add `data` (or `isLoading`) as a dep and gate execution on a one-shot ref so it only fires the first time `data` becomes defined:

  ```tsx
  const didFocusRef = useRef(false);
  useEffect(() => {
    if (data && !didFocusRef.current) {
      backRef.current?.focus();
      didFocusRef.current = true;
    }
  }, [data]);
  ```

- Or use a callback ref on the back button that focuses on first attach:

  ```tsx
  const didFocusRef = useRef(false);
  const setBackRef = useCallback((el: HTMLButtonElement | null) => {
    if (el && !didFocusRef.current) {
      el.focus();
      didFocusRef.current = true;
    }
  }, []);
  // <button ref={setBackRef} ...>
  ```

Add a unit test that mounts `PostMortem` with the pending fetch first, then resolves the post-mortem promise, and asserts the back button has focus (`expect(document.activeElement).toBe(backBtn)`).
