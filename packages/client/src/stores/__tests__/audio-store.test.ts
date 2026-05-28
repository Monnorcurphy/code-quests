import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAudioStore } from '../audio-store';

beforeEach(() => {
  localStorage.clear();
  useAudioStore.setState({
    muted: false,
    silentMode: false,
    masterVolume: 0.7,
    currentEvent: null,
  });
});

afterEach(() => {
  localStorage.clear();
});

describe('useAudioStore', () => {
  describe('default state', () => {
    it('muted defaults to false', () => {
      expect(useAudioStore.getState().muted).toBe(false);
    });

    it('silentMode defaults to false', () => {
      expect(useAudioStore.getState().silentMode).toBe(false);
    });

    it('masterVolume defaults to 0.7', () => {
      expect(useAudioStore.getState().masterVolume).toBe(0.7);
    });

    it('currentEvent defaults to null', () => {
      expect(useAudioStore.getState().currentEvent).toBeNull();
    });
  });

  describe('setters', () => {
    it('setMuted updates muted', () => {
      useAudioStore.getState().setMuted(true);
      expect(useAudioStore.getState().muted).toBe(true);
    });

    it('setSilentMode updates silentMode', () => {
      useAudioStore.getState().setSilentMode(true);
      expect(useAudioStore.getState().silentMode).toBe(true);
    });

    it('setMasterVolume updates masterVolume', () => {
      useAudioStore.getState().setMasterVolume(0.3);
      expect(useAudioStore.getState().masterVolume).toBe(0.3);
    });

    it('setCurrentEvent updates currentEvent', () => {
      useAudioStore.getState().setCurrentEvent('COMBAT');
      expect(useAudioStore.getState().currentEvent).toBe('COMBAT');
    });

    it('setCurrentEvent can clear to null', () => {
      useAudioStore.getState().setCurrentEvent('TOWN');
      useAudioStore.getState().setCurrentEvent(null);
      expect(useAudioStore.getState().currentEvent).toBeNull();
    });
  });

  describe('localStorage persistence', () => {
    it('persists muted to localStorage', () => {
      useAudioStore.getState().setMuted(true);
      const stored = JSON.parse(localStorage.getItem('code-quests.audio') ?? '{}') as {
        state: Record<string, unknown>;
      };
      expect(stored.state.muted).toBe(true);
    });

    it('persists silentMode to localStorage', () => {
      useAudioStore.getState().setSilentMode(true);
      const stored = JSON.parse(localStorage.getItem('code-quests.audio') ?? '{}') as {
        state: Record<string, unknown>;
      };
      expect(stored.state.silentMode).toBe(true);
    });

    it('persists masterVolume to localStorage', () => {
      useAudioStore.getState().setMasterVolume(0.4);
      const stored = JSON.parse(localStorage.getItem('code-quests.audio') ?? '{}') as {
        state: Record<string, unknown>;
      };
      expect(stored.state.masterVolume).toBe(0.4);
    });

    it('does not persist currentEvent to localStorage', () => {
      useAudioStore.getState().setCurrentEvent('COMBAT');
      const stored = JSON.parse(localStorage.getItem('code-quests.audio') ?? '{}') as {
        state: Record<string, unknown>;
      };
      expect(stored.state.currentEvent).toBeUndefined();
    });

    it('re-hydrates state from localStorage', async () => {
      // Reset state first (persist writes defaults to localStorage)
      useAudioStore.setState({
        muted: false,
        silentMode: false,
        masterVolume: 0.7,
        currentEvent: null,
      });

      // Override localStorage with the values to rehydrate (after setState so persist doesn't clobber them)
      localStorage.setItem(
        'code-quests.audio',
        JSON.stringify({
          state: { muted: true, silentMode: true, masterVolume: 0.2 },
          version: 0,
        })
      );

      await useAudioStore.persist.rehydrate();

      expect(useAudioStore.getState().muted).toBe(true);
      expect(useAudioStore.getState().silentMode).toBe(true);
      expect(useAudioStore.getState().masterVolume).toBe(0.2);
    });

    it('currentEvent is not overwritten during rehydration', async () => {
      // Set currentEvent (persist writes state without currentEvent to localStorage)
      useAudioStore.setState({ currentEvent: 'BOSS' });

      // Rehydrate — stored state has no currentEvent so it should remain
      await useAudioStore.persist.rehydrate();

      expect(useAudioStore.getState().currentEvent).toBe('BOSS');
    });
  });
});
