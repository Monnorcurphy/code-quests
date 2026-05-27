# BUG: onClick={onCancelRef.current} — unnecessary ref indirection for click handler

**Severity:** LOW
**File(s):** `packages/client/src/features/guild/recruit-modal.tsx`

## Problem

The Cancel button uses `onClick={onCancelRef.current}` instead of `onClick={onCancel}`:

```tsx
<button type="button" onClick={onCancelRef.current} disabled={disabled}>
  Cancel
</button>
```

The `onCancelRef` pattern (store callback in ref, sync in layoutless effect) is necessary for the auto-dismiss `setTimeout` callback, because that runs outside the render cycle and would capture a stale closure. DOM event handlers do not have this problem — React updates them on every render, so `onClick={onCancel}` always calls the latest value of `onCancel`.

Using `onCancelRef.current` here:
- Reads the ref value at render time (same timing as reading the prop directly)
- Adds complexity without adding correctness

## Expected

Click handlers should reference props directly. Refs are the right tool for callbacks invoked asynchronously (timers, subscriptions) — not for synchronous event handlers.

## Fix

```tsx
// Before
<button type="button" onClick={onCancelRef.current} disabled={disabled}>

// After
<button type="button" onClick={onCancel} disabled={disabled}>
```

After this change, `onCancelRef` is no longer needed at all. Remove it along with the effect that syncs it:

```tsx
// Remove:
const onCancelRef = useRef(onCancel);

useEffect(() => {
  onSuccessRef.current = onSuccess;
  onCancelRef.current = onCancel;  // remove this line (or remove the whole effect if onSuccess still uses ref)
});
```

`onSuccessRef` still needs to be kept — it is used inside the `setTimeout` auto-dismiss, which IS an async callback that requires the ref pattern.
