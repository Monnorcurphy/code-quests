# BUG: Capstone E2E missing required assertions for Silent Mode and Mute backend behavior

**Severity:** HIGH
**File(s):** `packages/client/tests/e2e/phase-8-audio-capstone.spec.ts`

## Problem

The task spec for `gacrux` enumerates explicit E2E assertions that the
implementation must verify. Items 5, 6, 7, and 8 are missing or only
half-implemented:

Spec asks (from `metrics/task-gacrux-context.md`):

> 5. Simulates a monster encounter (drive via test helper / store hook) — mood becomes "In combat"
> 6. Resolves the encounter as defeated → asserts a "Monster defeated!" toast appears
> 7. Opens settings → toggles Silent Mode → asserts further events produce visual cues but **no `backend.play` calls**
> 8. Toggles Mute (with silent mode off) → asserts **`backend.setMuted(true)` was called** and audio events still dispatch

What the test file actually contains:

- No combat-encounter simulation (#5) and no Victory toast assertion (#6).
- The Silent Mode test (lines 117–131) only flips the switch and asserts a
  helper-text string is visible — it does NOT verify that subsequent cues
  fail to reach `backend.play`. Without that assertion, a regression that
  routes Silent Mode through the WebAudioBackend would silently pass.
- The Mute test (lines 100–115) only toggles `aria-checked` — it does NOT
  verify that the backend's `setMuted` was invoked.

The cue-bus log (`window.__audioLog__`) only records calls to `dispatchCue`,
not calls to `backend.play` or `backend.setMuted`. So even with the existing
test hook, the assertions in #7 and #8 cannot be made from the cue bus alone.

Because these assertions are missing, the tests do not enforce the
spec-mandated invariants. Combined with `review-1.md` (audio buffers never
preload), it is currently impossible to detect that production audio is
broken from the test suite.

## Expected

Per `.claude/rules/testing.md` and `.claude/rules/review-contract.md`:
- Every requirement enumerated in the task spec must have a matching test.
- Missing-tests is a HIGH-severity rule violation per the severity taxonomy.

The capstone test file must:
1. Simulate a monster encounter (drive `useEncounterStore` directly from the
   page) and assert the mood indicator becomes "In Combat".
2. Resolve the encounter as `outcome: 'victory'` and assert the
   "Monster defeated!" stinger toast appears.
3. Expose a counter for `backend.play` calls — either via
   `page.exposeBinding` or by reaching into a SilentBackend mock — and
   assert that after Silent Mode is enabled, no additional `backend.play`
   calls are made even though `__audioLog__` keeps growing.
4. Expose a counter for `backend.setMuted` calls and assert it was called
   with `true` after the Mute switch is flipped on.

## Fix

Extend `phase-8-audio-capstone.spec.ts` with the four missing assertions
above. Suggested approach for the backend assertions: install a wrapper
backend at app startup (gated by a `window.__audioTestMode__` flag) that
mirrors the real backend's calls into `window.__backendCalls__: string[]`,
then assert against that array in the E2E test.

Also add `pnpm test:e2e` to whatever CI gate is used to verify the phase —
right now `pnpm test` only runs vitest, so the entire capstone E2E suite
is skipped during local verification.
