import type { AudioBackend } from './backend';
import type { AudioEvent } from './audio-events';

export interface CallRecord {
  method: string;
  args: unknown[];
}

export class SilentBackend implements AudioBackend {
  readonly calls: CallRecord[] = [];

  async preload(events: AudioEvent[]): Promise<void> {
    this.calls.push({ method: 'preload', args: [events] });
  }

  play(event: AudioEvent, opts?: { loop?: boolean; volume?: number }): void {
    this.calls.push({ method: 'play', args: [event, opts] });
  }

  stop(event: AudioEvent): void {
    this.calls.push({ method: 'stop', args: [event] });
  }

  stopAll(): void {
    this.calls.push({ method: 'stopAll', args: [] });
  }

  setMasterVolume(v: number): void {
    this.calls.push({ method: 'setMasterVolume', args: [v] });
  }

  setMuted(muted: boolean): void {
    this.calls.push({ method: 'setMuted', args: [muted] });
  }

  dispose(): void {
    this.calls.push({ method: 'dispose', args: [] });
  }
}
