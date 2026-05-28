import type { AudioEvent } from './audio-events';

export interface AudioBackend {
  preload(events: AudioEvent[]): Promise<void>;
  play(event: AudioEvent, opts?: { loop?: boolean; volume?: number }): void;
  stop(event: AudioEvent): void;
  stopAll(): void;
  setMasterVolume(v: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}
