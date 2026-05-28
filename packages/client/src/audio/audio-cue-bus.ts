import type { AudioEvent } from './audio-events';

type CueListener = (event: AudioEvent) => void;
const listeners = new Set<CueListener>();

export function subscribeCue(listener: CueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

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
