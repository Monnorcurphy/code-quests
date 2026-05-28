import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { WebAudioBackend } from './web-audio-backend';
import { SilentBackend } from './silent-backend';
import type { AudioBackend } from './backend';
import { useAudioStore } from '../stores/audio-store';

export const AudioBackendContext = createContext<AudioBackend | null>(null);

export function useAudioBackend(): AudioBackend | null {
  return useContext(AudioBackendContext);
}

interface AudioProviderProps {
  children: ReactNode;
}

export function AudioProvider({ children }: AudioProviderProps) {
  const silentMode = useAudioStore((s) => s.silentMode);
  const muted = useAudioStore((s) => s.muted);
  const masterVolume = useAudioStore((s) => s.masterVolume);
  const [backend, setBackend] = useState<AudioBackend | null>(null);
  const backendRef = useRef<AudioBackend | null>(null);
  backendRef.current = backend;

  // Create a new backend when silentMode changes; dispose the old one on cleanup
  useEffect(() => {
    const b: AudioBackend = silentMode ? new SilentBackend() : new WebAudioBackend();
    setBackend(b);
    return () => {
      b.dispose();
    };
  }, [silentMode]);

  // Sync muted state whenever backend or muted changes
  useEffect(() => {
    if (!backend) return;
    backend.setMuted(muted);
  }, [backend, muted]);

  // Sync master volume whenever backend or masterVolume changes
  useEffect(() => {
    if (!backend) return;
    backend.setMasterVolume(masterVolume);
  }, [backend, masterVolume]);

  // Autoplay unlock — resume the backend on first click or keydown
  useEffect(() => {
    function handleInteraction() {
      const b = backendRef.current;
      if (b && 'resume' in b && typeof (b as { resume?: () => void }).resume === 'function') {
        (b as { resume: () => void }).resume();
      }
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    }

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  return <AudioBackendContext.Provider value={backend}>{children}</AudioBackendContext.Provider>;
}
