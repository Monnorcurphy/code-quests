import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { AudioProvider, useAudioBackend } from '../audio-provider';
import { SilentBackend } from '../silent-backend';
import type { AudioBackend } from '../backend';

// AudioProvider uses silentMode from the store; mock it to return silentMode: true
// so we control the backend via SilentBackend (no real AudioContext required).
vi.mock('../../stores/audio-store', () => ({
  useAudioStore: vi.fn(
    (selector: (s: { silentMode: boolean; muted: boolean; masterVolume: number }) => unknown) =>
      selector({ silentMode: true, muted: false, masterVolume: 1 }),
  ),
}));

function BackendCapture({ onBackend }: { onBackend: (b: AudioBackend | null) => void }) {
  const backend = useAudioBackend();
  useEffect(() => {
    onBackend(backend);
  }, [backend, onBackend]);
  return null;
}

describe('AudioProvider — preload wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls preload on the backend with all audio events', async () => {
    const preloadSpy = vi.spyOn(SilentBackend.prototype, 'preload');

    render(
      <AudioProvider>
        <div />
      </AudioProvider>,
    );

    await waitFor(() => {
      expect(preloadSpy).toHaveBeenCalledWith([
        'TOWN',
        'ROAD',
        'COMBAT',
        'BOSS',
        'VICTORY_STINGER',
        'QUEST_COMPLETE',
        'QUEST_FAILED',
        'PAUSE_BELL',
      ]);
    });
  });

  it('exposes backend to consumers only after preload completes', async () => {
    let preloadResolve: () => void = () => {};
    vi.spyOn(SilentBackend.prototype, 'preload').mockImplementation(
      () => new Promise<void>((res) => { preloadResolve = res; }),
    );

    const capturedBackends: Array<AudioBackend | null> = [];
    render(
      <AudioProvider>
        <BackendCapture onBackend={(b) => capturedBackends.push(b)} />
      </AudioProvider>,
    );

    // Initial render — backend should still be null (preload hasn't resolved yet)
    expect(capturedBackends.filter((b) => b !== null)).toHaveLength(0);

    // Resolve preload
    preloadResolve();

    // Backend becomes non-null only after preload resolves
    await waitFor(() => {
      expect(capturedBackends.some((b) => b !== null)).toBe(true);
    });
  });
});
