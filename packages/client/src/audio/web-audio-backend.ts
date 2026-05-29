import type { AudioEvent } from './audio-events';
import type { AudioBackend } from './backend';
import { AUDIO_MANIFEST } from './asset-manifest';
import { isProceduralTheme, synthesizeTheme } from './procedural-music';

const CROSSFADE_DURATION = 0.4;

type AudioContextFactory = () => AudioContext;

export class WebAudioBackend implements AudioBackend {
  private readonly contextFactory: AudioContextFactory;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private readonly buffers = new Map<AudioEvent, AudioBuffer>();
  private readonly loopingGains = new Map<AudioEvent, GainNode>();
  private readonly loopingSources = new Map<AudioEvent, AudioBufferSourceNode>();
  private activeLoopedEvent: AudioEvent | null = null;
  private pendingVolume = 1;
  private muted = false;

  constructor(contextFactory?: AudioContextFactory) {
    this.contextFactory = contextFactory ?? (() => new AudioContext());
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = this.contextFactory();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : this.pendingVolume,
        this.ctx.currentTime,
      );
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  async preload(events: AudioEvent[]): Promise<void> {
    const ctx = this.getContext();
    await Promise.all(
      events.map(async (event) => {
        // Looping themes use procedural chiptune (~3:30 each) instead of
        // the 2-second WAV stubs the project shipped with.
        if (isProceduralTheme(event)) {
          try {
            const buf = await synthesizeTheme(event);
            if (buf) {
              this.buffers.set(event, buf);
              return;
            }
          } catch {
            // Fall through to WAV fallback below
          }
        }
        const url = AUDIO_MANIFEST[event];
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        try {
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(event, audioBuffer);
        } catch {
          // eslint-disable-next-line no-console
          console.warn(`[AudioBackend] Failed to decode ${url}`);
        }
      }),
    );
  }

  play(event: AudioEvent, opts?: { loop?: boolean; volume?: number }): void {
    const ctx = this.getContext();
    const buffer = this.buffers.get(event);
    if (!buffer || !this.masterGain) return;

    if (opts?.loop) {
      this.playLooped(ctx, event, opts.volume ?? 1);
    } else {
      this.playOneShot(ctx, event, opts?.volume ?? 1);
    }
  }

  private playLooped(ctx: AudioContext, event: AudioEvent, volume: number): void {
    const now = ctx.currentTime;
    const crossfadeEnd = now + CROSSFADE_DURATION;

    // Handle same-event re-entrant: fade out and clean up the existing instance before replacing
    const existingSource = this.loopingSources.get(event);
    const existingGain = this.loopingGains.get(event);
    if (existingSource && existingGain) {
      existingGain.gain.linearRampToValueAtTime(0, crossfadeEnd);
      try {
        existingSource.stop(crossfadeEnd);
      } catch {
        // already scheduled to stop
      }
      existingSource.addEventListener('ended', () => {
        existingGain.disconnect();
        if (this.loopingGains.get(event) === existingGain) this.loopingGains.delete(event);
        if (this.loopingSources.get(event) === existingSource) this.loopingSources.delete(event);
      });
    }

    // Fade out the previously active (different) event; capture refs to avoid stale-closure bugs
    if (this.activeLoopedEvent && this.activeLoopedEvent !== event) {
      const prevGain = this.loopingGains.get(this.activeLoopedEvent);
      const prevSource = this.loopingSources.get(this.activeLoopedEvent);
      prevGain?.gain.linearRampToValueAtTime(0, crossfadeEnd);
      try {
        prevSource?.stop(crossfadeEnd);
      } catch {
        // already scheduled to stop
      }
      const prevEvent = this.activeLoopedEvent;
      prevSource?.addEventListener('ended', () => {
        prevGain?.disconnect();
        if (this.loopingGains.get(prevEvent) === prevGain) this.loopingGains.delete(prevEvent);
        if (this.loopingSources.get(prevEvent) === prevSource) this.loopingSources.delete(prevEvent);
      });
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, crossfadeEnd);
    gainNode.connect(this.masterGain!);

    const source = ctx.createBufferSource();
    source.buffer = this.buffers.get(event) ?? null;
    source.loop = true;
    source.connect(gainNode);
    source.start(now);

    this.loopingGains.set(event, gainNode);
    this.loopingSources.set(event, source);
    this.activeLoopedEvent = event;
  }

  private playOneShot(ctx: AudioContext, event: AudioEvent, volume: number): void {
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.connect(this.masterGain!);

    const source = ctx.createBufferSource();
    source.buffer = this.buffers.get(event) ?? null;
    source.loop = false;
    source.connect(gainNode);
    source.addEventListener('ended', () => {
      source.disconnect();
      gainNode.disconnect();
    });
    source.start(ctx.currentTime);
  }

  stop(event: AudioEvent): void {
    const source = this.loopingSources.get(event);
    if (source) {
      try {
        source.stop();
      } catch {
        // Source may have already been scheduled to stop
      }
      source.disconnect();
      this.loopingSources.delete(event);
    }
    const gainNode = this.loopingGains.get(event);
    if (gainNode) {
      gainNode.disconnect();
      this.loopingGains.delete(event);
    }
    if (this.activeLoopedEvent === event) {
      this.activeLoopedEvent = null;
    }
  }

  stopAll(): void {
    for (const event of [...this.loopingSources.keys()]) {
      this.stop(event);
    }
  }

  setMasterVolume(v: number): void {
    this.pendingVolume = v;
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : this.pendingVolume,
        this.ctx.currentTime,
      );
    }
  }

  dispose(): void {
    this.stopAll();
    if (this.ctx) {
      void this.ctx.close();
    }
    this.ctx = null;
    this.masterGain = null;
    this.buffers.clear();
    this.loopingGains.clear();
    this.loopingSources.clear();
    this.activeLoopedEvent = null;
  }
}
