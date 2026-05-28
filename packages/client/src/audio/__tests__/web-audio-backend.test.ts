import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebAudioBackend } from '../web-audio-backend';
import { makeMockAudioContext } from './test-helpers';

describe('WebAudioBackend', () => {
  let mockCtx: ReturnType<typeof makeMockAudioContext>;
  let backend: WebAudioBackend;

  beforeEach(() => {
    mockCtx = makeMockAudioContext();
    backend = new WebAudioBackend(() => mockCtx as unknown as AudioContext);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('preload', () => {
    it('fetches the correct URL for TOWN', async () => {
      await backend.preload(['TOWN']);
      expect(globalThis.fetch).toHaveBeenCalledWith('/audio/town-theme.wav');
    });

    it('calls decodeAudioData with the fetched buffer', async () => {
      await backend.preload(['TOWN']);
      expect(mockCtx.decodeAudioData).toHaveBeenCalled();
    });

    it('preloads multiple events in parallel', async () => {
      await backend.preload(['TOWN', 'ROAD']);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(globalThis.fetch).toHaveBeenCalledWith('/audio/town-theme.wav');
      expect(globalThis.fetch).toHaveBeenCalledWith('/audio/road-theme.wav');
    });

    it('creates the AudioContext on first call', async () => {
      await backend.preload(['TOWN']);
      expect(mockCtx.createGain).toHaveBeenCalled();
    });
  });

  describe('play — looped', () => {
    it('creates a source with loop=true connected through a gain node', async () => {
      await backend.preload(['TOWN']);
      backend.play('TOWN', { loop: true });

      const source = mockCtx.createdSources[0];
      expect(source.loop).toBe(true);
      expect(source.start).toHaveBeenCalled();
      expect(source.connect).toHaveBeenCalled();
    });

    it('ramps in the looped event gain from 0 to 1', async () => {
      await backend.preload(['TOWN']);
      backend.play('TOWN', { loop: true });

      const townGain = mockCtx.createdGains[1];
      expect(townGain.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
      expect(townGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    });
  });

  describe('play — crossfade', () => {
    it('ramps out TOWN gain and ramps in ROAD gain when switching', async () => {
      await backend.preload(['TOWN', 'ROAD']);

      backend.play('TOWN', { loop: true });
      const townGain = mockCtx.createdGains[1];

      backend.play('ROAD', { loop: true });
      const roadGain = mockCtx.createdGains[2];

      expect(townGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
      expect(roadGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    });

    it('schedules the previous source to stop at crossfade end', async () => {
      await backend.preload(['TOWN', 'ROAD']);

      backend.play('TOWN', { loop: true });
      const townSource = mockCtx.createdSources[0];

      backend.play('ROAD', { loop: true });

      expect(townSource.stop).toHaveBeenCalledWith(expect.any(Number));
    });

    it('registers an ended listener on the previous source for cleanup', async () => {
      await backend.preload(['TOWN', 'ROAD']);

      backend.play('TOWN', { loop: true });
      const townSource = mockCtx.createdSources[0];

      backend.play('ROAD', { loop: true });

      expect(townSource.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    });

    it('crossfade respects custom volume', async () => {
      await backend.preload(['TOWN', 'ROAD']);
      backend.play('TOWN', { loop: true });
      backend.play('ROAD', { loop: true, volume: 0.5 });

      const roadGain = mockCtx.createdGains[2];
      expect(roadGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));
    });
  });

  describe('play — one-shot', () => {
    it('creates a source with loop=false', async () => {
      await backend.preload(['VICTORY_STINGER']);
      backend.play('VICTORY_STINGER');

      const source = mockCtx.createdSources[0];
      expect(source.loop).toBe(false);
      expect(source.start).toHaveBeenCalled();
    });

    it('registers an ended listener for auto-disconnect', async () => {
      await backend.preload(['VICTORY_STINGER']);
      backend.play('VICTORY_STINGER');

      const source = mockCtx.createdSources[0];
      expect(source.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
    });

    it('disconnects source and gain when ended fires', async () => {
      await backend.preload(['VICTORY_STINGER']);
      backend.play('VICTORY_STINGER');

      const source = mockCtx.createdSources[0];
      const endedCall = (source.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === 'ended',
      );
      const endedCallback = endedCall?.[1] as (() => void) | undefined;
      endedCallback?.();

      expect(source.disconnect).toHaveBeenCalled();
      expect(mockCtx.createdGains[1].disconnect).toHaveBeenCalled();
    });
  });

  describe('setMuted', () => {
    it('setMuted(true) sets master gain to 0', async () => {
      await backend.preload(['TOWN']);
      backend.setMuted(true);

      const masterGain = mockCtx.createdGains[0];
      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    });

    it('setMuted(false) restores the previous volume', async () => {
      await backend.preload(['TOWN']);
      backend.setMasterVolume(0.8);
      backend.setMuted(true);
      backend.setMuted(false);

      const masterGain = mockCtx.createdGains[0];
      expect(masterGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.8, expect.any(Number));
    });

    it('setMuted(true) does not stop scheduled sources', async () => {
      await backend.preload(['TOWN']);
      backend.play('TOWN', { loop: true });
      const source = mockCtx.createdSources[0];

      backend.setMuted(true);

      expect(source.stop).not.toHaveBeenCalled();
    });
  });

  describe('setMasterVolume', () => {
    it('updates master gain when not muted', async () => {
      await backend.preload(['TOWN']);
      backend.setMasterVolume(0.5);

      const masterGain = mockCtx.createdGains[0];
      expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0.5, expect.any(Number));
    });

    it('does not update master gain when muted', async () => {
      await backend.preload(['TOWN']);
      backend.setMuted(true);

      const masterGain = mockCtx.createdGains[0];
      const callCountBeforeVolume = (masterGain.gain.setValueAtTime as ReturnType<typeof vi.fn>)
        .mock.calls.length;

      backend.setMasterVolume(0.5);

      const callCountAfter = (masterGain.gain.setValueAtTime as ReturnType<typeof vi.fn>).mock
        .calls.length;
      expect(callCountAfter).toBe(callCountBeforeVolume);
    });
  });

  describe('stop', () => {
    it('stops and disconnects the looped source', async () => {
      await backend.preload(['TOWN']);
      backend.play('TOWN', { loop: true });
      const source = mockCtx.createdSources[0];
      const gainNode = mockCtx.createdGains[1];

      backend.stop('TOWN');

      expect(source.stop).toHaveBeenCalled();
      expect(source.disconnect).toHaveBeenCalled();
      expect(gainNode.disconnect).toHaveBeenCalled();
    });

    it('does nothing for an event that is not playing', () => {
      expect(() => backend.stop('TOWN')).not.toThrow();
    });
  });

  describe('stopAll', () => {
    it('stops all active looped sources', async () => {
      await backend.preload(['TOWN', 'ROAD']);
      backend.play('TOWN', { loop: true });
      backend.play('ROAD', { loop: true });

      backend.stopAll();

      for (const source of mockCtx.createdSources) {
        expect(source.stop).toHaveBeenCalled();
      }
    });
  });

  describe('dispose', () => {
    it('closes the AudioContext', async () => {
      await backend.preload(['TOWN']);
      backend.dispose();
      expect(mockCtx.close).toHaveBeenCalled();
    });

    it('stops all looped sources on dispose', async () => {
      await backend.preload(['TOWN']);
      backend.play('TOWN', { loop: true });
      const source = mockCtx.createdSources[0];

      backend.dispose();

      expect(source.stop).toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('calls ctx.resume() when context is suspended', async () => {
      await backend.preload(['TOWN']);
      mockCtx.state = 'suspended';

      backend.resume();

      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('does not call ctx.resume() when context is already running', async () => {
      await backend.preload(['TOWN']);
      mockCtx.state = 'running';

      backend.resume();

      expect(mockCtx.resume).not.toHaveBeenCalled();
    });
  });
});
