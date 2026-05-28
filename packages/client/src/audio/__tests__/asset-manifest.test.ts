import { describe, it, expect } from 'vitest';
import { AUDIO_MANIFEST } from '../asset-manifest';
import { LOOPING_EVENTS, ONE_SHOT_EVENTS } from '../audio-events';
import type { AudioEvent } from '../audio-events';

const ALL_EVENTS: AudioEvent[] = [
  ...Array.from(LOOPING_EVENTS),
  ...Array.from(ONE_SHOT_EVENTS),
];

describe('AUDIO_MANIFEST', () => {
  it('has an entry for every AudioEvent', () => {
    for (const event of ALL_EVENTS) {
      expect(AUDIO_MANIFEST).toHaveProperty(event);
      expect(typeof AUDIO_MANIFEST[event]).toBe('string');
      expect(AUDIO_MANIFEST[event].length).toBeGreaterThan(0);
    }
  });

  it('has no extra entries beyond the defined AudioEvent values', () => {
    const manifestKeys = Object.keys(AUDIO_MANIFEST);
    expect(manifestKeys).toHaveLength(ALL_EVENTS.length);
    for (const key of manifestKeys) {
      expect(ALL_EVENTS).toContain(key as AudioEvent);
    }
  });

  it('all paths start with /audio/', () => {
    for (const [, path] of Object.entries(AUDIO_MANIFEST)) {
      expect(path).toMatch(/^\/audio\//);
    }
  });

  it('all paths reference a known audio file extension', () => {
    for (const [, path] of Object.entries(AUDIO_MANIFEST)) {
      expect(path).toMatch(/\.(ogg|mp3|wav)$/);
    }
  });
});
