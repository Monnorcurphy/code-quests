# BUG: Test scaffolding (`window.__audioLog__` hook) shipped in production cue bus

**Severity:** LOW
**File(s):** `packages/client/src/audio/audio-cue-bus.ts`

## Problem

`dispatchCue()` now contains an unconditional test-mode side channel:

```ts
export function dispatchCue(event: AudioEvent): void {
  for (const l of listeners) l(event);
  // Test hook: append to window.__audioLog__ if it exists (set by E2E tests)
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    if (Array.isArray(w.__audioLog__)) {
      (w.__audioLog__ as AudioEvent[]).push(event);
    }
  }
}
```

This is shipped in the production bundle. The comment itself flags it as a
test hook. Any script (extension, devtools paste, third-party widget) that
sets `window.__audioLog__ = []` will then receive a live event stream of
quest activity. The leak is small in scope, but it violates the principle
of separating test infrastructure from production code, and ESLint cannot
warn on `window` bracket access cast through `unknown`.

## Expected

Per `rules/common-findings.md` §2 (debug output) and `rules/typescript.md`:
> "No console.log in production code — use a proper logger or remove
> before committing"

The same principle applies to test hooks. Either gate by `import.meta.env.DEV`
/ a build-time flag so the hook is tree-shaken in production builds, or
expose the audit log via a proper subscriber that the E2E test installs
explicitly (e.g. `subscribeCue` from inside `addInitScript`).

## Fix

Replace the block with a dev-only branch that the production build will
tree-shake:

```ts
export function dispatchCue(event: AudioEvent): void {
  for (const l of listeners) l(event);
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const log = (window as { __audioLog__?: AudioEvent[] }).__audioLog__;
    if (Array.isArray(log)) log.push(event);
  }
}
```

Or — preferred — remove the hook entirely and have the E2E test attach a
real `subscribeCue` listener inside `addInitScript`, then read the buffered
events back via `page.evaluate`. That keeps production code free of test
glue.
