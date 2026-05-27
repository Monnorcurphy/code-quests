import { create } from 'zustand';
import type { SceneKey } from '../game/scene-registry';

interface TownState {
  currentScene: SceneKey;
  playerX: number;
  activeModal: 'recruit' | 'draft' | null;
  setScene: (scene: SceneKey) => void;
}

export const useTownStore = create<TownState>((set) => ({
  currentScene: 'boot',
  playerX: 0,
  activeModal: null,
  setScene: (scene) => set({ currentScene: scene }),
}));
