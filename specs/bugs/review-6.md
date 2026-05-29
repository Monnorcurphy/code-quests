# BUG: Phase 11 E2E does not verify audio playback

**Severity:** HIGH
**File(s):** packages/client/tests/e2e/phase-11-capstone.spec.ts

## Problem

The task spec for `eclipse` requires the Playwright capstone E2E to
verify that audio was played at the expected moments:

> 7. Audio plays (Town theme during planning, Combat theme during
>    fights, Pause bell on PAUSED_INPUT, Victory fanfare at completion)
>    — verified by checking that the `AudioBackend` received the
>    expected `play()` calls

And the carry-forward notes spell out the implementation hint:

> Audio assertion in the E2E test uses an `AudioBackend` spy installed
> by the test, not real audio playback (which is unreliable in headless
> browsers).

The committed `phase-11-capstone.spec.ts` mocks DB and HTTP endpoints
and runs an axe-core sweep, but contains no audio assertions at all:
there is no `AudioBackend` spy, no expectation that a Town theme played
during planning, no Pause bell assertion at step 7, no Victory fanfare
assertion. Grep for `audio`, `play`, `theme`, `bell`, or `fanfare` in
the file returns zero hits.

## Expected

At minimum, one of:

1. The E2E installs an `AudioBackend` spy via `addInitScript` (e.g. by
   setting `window.__audioBackendSpy__` or by swapping the backend
   implementation), then asserts that the spy received:
   - A Town theme `play()` during step 1–4 (planning phase)
   - A Pause bell `play()` at step 7 (PAUSED_INPUT)
   - A Victory fanfare `play()` at step 10/12 (success/wrap)
2. Or, if a true backend spy is not feasible from Playwright, an
   equivalent assertion against the audio store's state (which Phase 8
   exposes) so that the journey is provably auditable.

## Fix

Implement option 1: expose an `AudioBackend` test hook (similar to the
existing `__tourStore`, `__townStore` window exports in
`main.tsx`), and have the E2E install a spy on it before
`page.goto('/town/town-square')`. After advancing through each relevant
step, assert the spy's recorded `play()` calls.

If exposing a test hook is out of scope here, file this as a
carry-forward task — but the current E2E does not satisfy the
passing condition as written.
