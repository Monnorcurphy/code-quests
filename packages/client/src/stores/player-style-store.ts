import { create } from 'zustand';
import { AdventurerStyleSchema, type AdventurerStyle } from '@code-quests/shared';

// Player avatar styling is persisted in localStorage rather than the DB —
// the player isn't a server-side adventurer entity, just the user's
// in-game representation. This store hydrates from localStorage at boot
// and writes back on every change.

const STORAGE_KEY = 'cq.player-style';

function readFromStorage(): AdventurerStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = AdventurerStyleSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function writeToStorage(style: AdventurerStyle): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(style));
  } catch {
    // localStorage may be unavailable (SSR, private mode) — ignore
  }
}

interface PlayerStyleState {
  style: AdventurerStyle;
  setStyle: (style: AdventurerStyle) => void;
}

export const usePlayerStyleStore = create<PlayerStyleState>((set) => ({
  style: typeof window !== 'undefined' ? readFromStorage() : {},
  setStyle: (style) => {
    writeToStorage(style);
    set({ style });
  },
}));

// Texture keys the player sprite reads. Generated once per style change via
// generateAdventurerTextures(scene, 'player', style).
export const PLAYER_TEXTURE_KEYS = {
  idle: 'adv-player-idle',
  walk: 'adv-player-walk',
  attack: 'adv-player-attack',
} as const;
