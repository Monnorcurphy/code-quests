# BUG: WebAudioBackend buffers are never preloaded — no audio plays in production

**Severity:** CRITICAL
**File(s):** `packages/client/src/audio/audio-provider.tsx`, `packages/client/src/audio/audio-controller-mount.tsx`, `packages/client/src/audio/audio-controller.ts`

## Problem

`WebAudioBackend.preload(events)` is the only code path that fetches the `.wav`
files and populates the internal `buffers: Map<AudioEvent, AudioBuffer>`. A
project-wide grep confirms `preload(` is invoked exclusively from unit-test
files (`audio/__tests__/web-audio-backend.test.ts`, `silent-backend.test.ts`).
No production code calls `backend.preload(...)`:

- `audio-provider.tsx` constructs `new WebAudioBackend()` and skips preload.
- `audio-controller-mount.tsx` mounts the provider, calls `controller.start()`,
  and skips preload.
- `audio-controller.ts` `start()` immediately calls `backend.play('TOWN', { loop: true })`
  without ever preloading.

`WebAudioBackend.play()` is defined as:

```ts
play(event, opts) {
  const ctx = this.getContext();
  const buffer = this.buffers.get(event);
  if (!buffer || !this.masterGain) return; // <-- silently returns
  ...
}
```

Because `buffers` is permanently empty in production, **every `play()` call is
a silent no-op**. The mood indicator, ARIA announcer, and stinger toasts still
fire because they listen on the `dispatchCue` bus, but the user never hears any
audio — the entire purpose of Phase 8 is broken.

The E2E `phase-8-audio-capstone.spec.ts` and unit tests cannot detect this
because they either assert against the cue bus (`window.__audioLog__`) or
mock `decodeAudioData`/`fetch` directly inside the backend tests. Nothing
exercises the real provider → controller → backend chain with an unmocked
WebAudioBackend.

## Expected

Per the task spec acceptance criteria #2:
> "After first click/keypress, **Town theme plays** (audible) AND the mood
> indicator shows 'Town / Calm'"

And criteria #3–#8 all require audible output. The CC0 placeholder `.wav`
files in `packages/client/public/audio/` must be fetched, decoded, and
playable.

## Fix

Add a preload step before the controller starts the loop. Recommended
location: inside `AudioProvider` after the backend is constructed, or inside
`AudioControllerMount`'s backend-effect, awaiting before calling `start()`.

```ts
// audio-provider.tsx, inside the silentMode useEffect (after creating b):
const b: AudioBackend = silentMode ? new SilentBackend() : new WebAudioBackend();
void b.preload(['TOWN', 'ROAD', 'COMBAT', 'BOSS',
                'VICTORY_STINGER', 'QUEST_COMPLETE', 'QUEST_FAILED', 'PAUSE_BELL']);
setBackend(b);
```

Then update `AudioControllerMount` so the controller only calls `play()`
after preload resolves (or have `WebAudioBackend.play()` lazily fetch on
miss as a fallback).

Also add an integration-level test (vitest or Playwright) that asserts
`WebAudioBackend.play()` is reached with a non-empty buffer after the
provider mounts — not a unit test against the backend in isolation, but the
real wiring through `AudioProvider` + `AudioControllerMount`. Without this
test, the regression will reappear.
