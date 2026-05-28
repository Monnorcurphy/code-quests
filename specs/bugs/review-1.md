# BUG: playLooped does not handle re-entrant calls — leaks sources and clobbers gains during rapid crossfade chains

**Severity:** HIGH
**File(s):** `packages/client/src/audio/web-audio-backend.ts` (lines 73-106)

## Problem

`playLooped()` keys `loopingGains` and `loopingSources` by `AudioEvent`, but does nothing to clean up an existing instance for the same event before starting a new one. Two distinct failure modes:

### Failure mode 1 — Same-event replay leaks an extra simultaneously-playing source

```ts
backend.play('TOWN', { loop: true });
backend.play('TOWN', { loop: true });
```

The second call hits the `activeLoopedEvent !== event` guard at line 77 and skips the crossfade block. It then creates a fresh `gainNode` and `BufferSourceNode`, starts the new source, and overwrites the map entries. The previous TOWN source/gain are never `stop()`-ed or `disconnect()`-ed and keep playing through `masterGain`. The user hears two TOWN tracks slightly out of phase. Each subsequent re-call leaks another voice.

### Failure mode 2 — Rapid A → B → A within the 400 ms crossfade silences the new A

```ts
backend.play('TOWN', { loop: true });   // t=0   maps: { TOWN: T1 }
backend.play('ROAD', { loop: true });   // t=10ms schedules T1.stop(t+0.4) and an 'ended' listener
                                        //        that does loopingGains.get('TOWN').disconnect()
backend.play('TOWN', { loop: true });   // t=20ms skips crossfade (no active TOWN comparison
                                        //        actually triggers — see below), overwrites
                                        //        loopingGains['TOWN']=T2_gain, loopingSources['TOWN']=T2_src
// ... ~400 ms later, T1's 'ended' fires ...
// The closure reads loopingGains.get('TOWN') → returns the NEW T2_gain.
// T2_gain.disconnect() detaches the live track from masterGain. TOWN goes silent.
// loopingGains.delete('TOWN') / loopingSources.delete('TOWN') wipe the map entries,
// so a later stop('TOWN') can no longer find/clean up the (orphaned, silenced) source.
```

This produces an intermittent "music randomly cuts out after ~400 ms" symptom that is very hard to diagnose, plus a leaked source that nothing can stop.

The 'ended' listener (lines 85–89) captures `prevEvent` by value but then re-looks-up by event key, which is exactly the unsafe pattern when the key can be reused before cleanup runs.

## Expected

- Calling `play(event, { loop: true })` while a looped instance for the same `event` is active must not leak the previous source/gain. Either restart cleanly or no-op.
- Cleanup callbacks for a specific source/gain pair must refer to that exact pair, not look it up by key (the key may have been rebound).
- The spec's invariant "Only one looped event audible at a time" must hold even under rapid switching (A → B → A within 400 ms).

## Fix

Two changes in `packages/client/src/audio/web-audio-backend.ts`:

1. In the cleanup callback, capture the gain/source by reference rather than by key:

   ```ts
   const prevEvent = this.activeLoopedEvent;
   const prevGainRef = prevGain;
   const prevSourceRef = prevSource;
   prevSource?.addEventListener('ended', () => {
     prevGainRef?.disconnect();
     if (this.loopingGains.get(prevEvent) === prevGainRef) {
       this.loopingGains.delete(prevEvent);
     }
     if (this.loopingSources.get(prevEvent) === prevSourceRef) {
       this.loopingSources.delete(prevEvent);
     }
   });
   ```

2. Handle the re-entrant same-event case at the top of `playLooped`. Simplest correct behavior: if there is already a live source for `event`, run the same crossfade-out + cleanup path on it before starting the new one (treat the existing instance as a "previous" instance regardless of whether it equals `activeLoopedEvent`). Equivalent code:

   ```ts
   const existingSource = this.loopingSources.get(event);
   const existingGain = this.loopingGains.get(event);
   if (existingSource && existingGain) {
     existingGain.gain.linearRampToValueAtTime(0, crossfadeEnd);
     try { existingSource.stop(crossfadeEnd); } catch { /* already scheduled */ }
     existingSource.addEventListener('ended', () => {
       existingGain.disconnect();
       if (this.loopingGains.get(event) === existingGain) this.loopingGains.delete(event);
       if (this.loopingSources.get(event) === existingSource) this.loopingSources.delete(event);
     });
   }
   ```
   Then drop the `this.activeLoopedEvent !== event` guard from the existing prev-event branch (or merge the two branches), since the same-event case is now handled above.

3. Add regression tests in `packages/client/src/audio/__tests__/web-audio-backend.test.ts`:
   - `play('TOWN', { loop: true })` twice in succession does not leak a second active source (assert `createdSources` either has 1 entry or the first one was `stop`-ped).
   - A → B → A within the crossfade window: simulate the first source's `ended` event firing and assert that the NEW A's gain node was NOT disconnected (i.e., `createdGains[lastTownGainIdx].disconnect` is not called).
