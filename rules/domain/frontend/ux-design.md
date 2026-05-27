# UX Design Principles

Every screen in a user-facing application must answer three questions. If any answer is missing, the screen has a UX bug.

## The Three Questions

### 1. Where am I?

The user must always know their location in the application.

- Context bar, breadcrumb, or page title visible at all times
- Active nav item highlighted (including parent items for child pages)
- Sub-pages have a "Back to [Parent]" affordance

### 2. What just happened?

Every user action must produce visible feedback.

- **Loading**: Disable trigger button + spinner. `aria-busy="true"` on container.
- **Success**: Auto-dismiss after 3-5 seconds. Never boolean show/hide — use a timed lifecycle (visible → fading → removed). `aria-live="polite"`.
- **Error**: Persist until user dismisses or retries successfully. `aria-live="assertive"`. Human-friendly copy, not error codes.
- Never leave the user without visual feedback for operations >200ms.

### 3. What do I do next?

The user should never face a blank screen or dead end.

- Every list page has an empty state with a call to action ("No jobs yet. Start by adding a job posting.")
- After a successful create/save, navigate back to the list view or show a next step
- Error messages include guidance on how to fix the problem

## Patterns

### Multi-Section Forms
- If a form has >3 sections, use per-section edit/save with independent state
- Never use a single Save button at the bottom of a long form
- Each section shows its own success/error feedback

### Batch Operations
- Show per-item progress, not a single spinner ("Processing 3 of 12...")
- Each item shows its own success/failure state

### Transitions
- State changes should animate, not jump (opacity, height, position)
- Respect `prefers-reduced-motion` — use `motion-safe:` prefix or media query
- Removing items from lists should animate out, not pop

### Language
- Speak human, not developer
- RIGHT: "We couldn't connect. Make sure the service is running and try again."
- WRONG: "ECONNREFUSED localhost:11434"
- RIGHT: "Something went wrong saving your profile. Your changes are still here — try again."
- WRONG: "Error: SQLITE_CONSTRAINT: UNIQUE constraint failed"
