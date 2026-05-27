# UX Feedback Requirements

- Every async action button MUST have three states: loading (disabled + spinner/text), success confirmation, and error feedback
- Success confirmations auto-dismiss after 3-5 seconds using CSS transitions or timers
- Test auto-dismiss timing with framework-specific fake timers (vi.useFakeTimers, jest.useFakeTimers, etc.)
- Error messages persist until dismissed by user action or corrected input — never auto-dismiss errors
- Long-running background tasks (downloads, API calls): use store-level event listeners, NOT component lifecycle hooks. Listeners must survive navigation between pages.
- Do NOT render buttons or click handlers for unimplemented features — no placeholder/no-op handlers
- Respect `prefers-reduced-motion`: skip animations, use instant show/hide instead
- All loading states must be announced to screen readers via `aria-live="polite"` regions
