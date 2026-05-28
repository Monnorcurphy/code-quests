# Review Pass — TASK canopus

**Task:** WebAudioBackend implementation
**Branch:** feature/canopus (parent: feature/acrux)
**Files changed:**
- `packages/client/src/audio/web-audio-backend.ts` (new)
- `packages/client/src/audio/__tests__/web-audio-backend.test.ts` (new)
- `packages/client/src/audio/__tests__/test-helpers.ts` (new)
- `progress.md` (updated)

## Checks Performed

### Build / verification
- `pnpm --filter @code-quests/client test web-audio-backend` → **25/25 passed** (489 ms)
- `pnpm --filter @code-quests/client typecheck` → clean
- `pnpm --filter @code-quests/client lint` → clean

### Spec conformance (against `metrics/task-canopus-context.md`)
- ✓ All `AudioBackend` interface methods implemented: `preload`, `play`, `stop`, `stopAll`, `setMasterVolume`, `setMuted`, `dispose`. Plus `resume()` as required for autoplay-policy.
- ✓ Lazy `AudioContext` construction via `contextFactory` — defaults to `new AudioContext()`, but injectable for tests.
- ✓ `preload` uses `fetch()` + `decodeAudioData()` keyed off `AUDIO_MANIFEST`.
- ✓ Looping events use per-event `GainNode` and a 400 ms `linearRampToValueAtTime` crossfade.
- ✓ One-shot events register an `ended` listener that disconnects source + gain.
- ✓ Master gain controls volume + mute; `setMuted(true)` ramps master to 0 but does NOT `stop()` sources (verified by the `setMuted does not stop scheduled sources` test).
- ✓ `setMuted` is reversible — unmute restores `pendingVolume` rather than the post-`setMasterVolume` 1 default.
- ✓ Decode errors handled with `console.warn` including file path (matches spec rule "console.warn only on decode errors with the file path included").
- ✓ Tests run under jsdom + injected mock; no real `AudioContext` needed.
- ✓ Helper file exposes `makeMockAudioContext()` returning the surface area used (createGain, createBufferSource, decodeAudioData, destination, currentTime, state, resume, close).

### Rule compliance
- ✓ TypeScript strict — no `any` (mocks cast through `unknown`, which is the documented pattern for test doubles).
- ✓ `no-console`: the single `console.warn` carries an `eslint-disable-next-line` comment scoped to one line — acceptable per spec direction.
- ✓ File naming kebab-case (`web-audio-backend.ts`, `test-helpers.ts`).
- ✓ Code length: 180 lines (under module 500 limit), no function over 35 lines.
- ✓ Function signatures ≤ 4 params; nesting ≤ 3; no complexity outliers.
- ✓ Error handling: both `catch` blocks are documented (the `decodeAudioData` one warns, the `source.stop()` one is annotated "Source may have already been scheduled to stop").
- ✓ No hardcoded secrets (`sk-` / `AKIA` / `api_key` / `password=` search clean).
- ✓ Cross-boundary: only boundary is `fetch()` against `/audio/*.wav`. `AUDIO_MANIFEST` is consistent with `AudioEvent` (typed `Record<AudioEvent, string>`), and the test asserts both URL strings agree.

### Adversarial checks
- Re-read `playLooped` carefully → **found bug**: the cleanup closure (lines 85–89) re-looks-up `loopingGains.get(prevEvent)` by key, but the map can be re-bound for the same event before the deferred `'ended'` fires. Filed as `specs/bugs/review-1.md` (HIGH).
- Verified `dispose()` path: `stopAll` empties maps then `void ctx.close()`; subsequent `play()` would lazily re-create context via factory. Reasonable.
- Verified `setMuted` reversibility test asserts the *last* setValueAtTime call equals the saved `pendingVolume`, which is the right invariant.
- Verified `preload` failure handling: `fetch` reject bubbles via `Promise.all`; bad-bytes path is the documented `decodeAudioData` reject branch with a warn.
- No conditional test assertions, no `if (visible)`-style guards.

## Informational notes

- **Backend re-use after dispose**: `dispose()` clears `ctx`/`masterGain`/buffers, but the next `play()` will quietly re-create a fresh context via the factory. Probably fine, but worth flagging if a future task expects `dispose()` to be terminal — could throw or short-circuit instead. (Not a bug given the current spec.)
- **`response.ok` not checked in `preload`**: a 404 still calls `arrayBuffer()` (gets the error HTML body) which then fails inside `decodeAudioData` and surfaces as the warn path. End behavior is correct, but an explicit `response.ok` check would produce a clearer warning. Not worth filing.
- **`test-helpers.ts` array indexing**: tests index `createdGains[1]` to grab the per-event gain (assuming the master gain is `[0]`). Functional today, but fragile to future helper changes — could expose a labeled accessor instead. Future polish; not a bug.
- **Edge cases not covered by tests**: fetch reject path, decode reject path (warn), and `stop()` mid-crossfade. Coverage is otherwise solid; these are next-cleanup candidates but not required by the spec.

## Final Verdict

**FAIL — 1 bug filed.**

`specs/bugs/review-1.md` (HIGH) — `playLooped` re-entry / rapid crossfade chain (A → B → A within 400 ms) silently disconnects the new instance's gain and leaks the old source. Same root cause causes a leak when the same event is played twice.
