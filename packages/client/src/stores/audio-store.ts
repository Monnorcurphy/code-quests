import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AudioEvent } from '../audio/audio-events';

interface AudioState {
  muted: boolean;
  silentMode: boolean;
  masterVolume: number;
  currentEvent: AudioEvent | null;
  setMuted: (muted: boolean) => void;
  setSilentMode: (silentMode: boolean) => void;
  setMasterVolume: (v: number) => void;
  setCurrentEvent: (event: AudioEvent | null) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      muted: false,
      silentMode: false,
      masterVolume: 0.7,
      currentEvent: null,
      setMuted: (muted) => set({ muted }),
      setSilentMode: (silentMode) => set({ silentMode }),
      setMasterVolume: (masterVolume) => set({ masterVolume }),
      setCurrentEvent: (currentEvent) => set({ currentEvent }),
    }),
    {
      name: 'code-quests.audio',
      partialize: (state) => ({
        muted: state.muted,
        silentMode: state.silentMode,
        masterVolume: state.masterVolume,
      }),
    }
  )
);
