# State Management Conventions

Rules for stores, React/framework effects, and event listeners.

## Effect Dependency Stability

Every effect dependency must be stable across renders. Unstable dependencies (inline callbacks, new object refs) cause re-runs that leak resources, re-snap focus, or stack event listeners.

Rules:
1. Callback props passed to children: wrap with `useCallback` (React) or equivalent
2. If wrapping isn't feasible, store the callback in a ref (ref identity is stable)
3. Never put a store selector result that returns a new object in deps — use shallow equality or select primitives

## Event Listeners: Store-Level, Not Component-Level

Register framework event listeners (Tauri `listen()`, WebSocket handlers, etc.) at the store/module level, not inside component effects.

Component effects that re-run on prop changes will stack multiple listeners, and cleanup race conditions can crash the app.

Register once at store level. Call the init function once at app startup.

## Read State Before Using It

When logic branches on "previous" or "current" state, always read the actual value from the store. Never hardcode a fallback that assumes a specific state.

## Focus Management in Modals and Panels

When a modal, confirmation dialog, or slide-out panel mounts:
1. Focus must move to the safest action (Cancel button for destructive confirms)
2. Focus must be trapped inside the modal (Tab cycles within, not escaping)
3. On dismiss, focus must return to the triggering element
4. Focus must NOT re-snap on every parent re-render — use a mount-only effect

## Async Save Pattern

All save operations must handle the second-save case:
1. Use UPSERT on the backend (see `database-conventions.md`)
2. Frontend must not permanently disable the save button after first save
3. Show success feedback, then re-enable for edits
4. If a save fails, show the error and keep the form populated (don't clear)

## Store Organization

- One store per domain (navigation, theme, auth, etc.)
- Each store exports a typed hook
- Async operations (API calls, IPC) happen inside store actions, not in components
- Store actions are the only code that calls backend APIs — components read state and call actions
