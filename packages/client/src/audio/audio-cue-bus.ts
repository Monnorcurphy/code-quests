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
}
