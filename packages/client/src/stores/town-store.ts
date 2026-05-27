import { create } from 'zustand';
import type { SceneKey } from '../game/scene-registry';

interface TownState {
  currentScene: SceneKey;
  playerX: number;
  facing: 'left' | 'right';
  activeModal: 'recruit' | 'draft' | null;
  setScene: (scene: SceneKey) => void;
  setPlayerX: (x: number) => void;
  setFacing: (facing: 'left' | 'right') => void;
}

export const useTownStore = create<TownState>((set) => ({
  currentScene: 'boot',
  playerX: 0,
  facing: 'right',
  activeModal: null,
  setScene: (scene) => set({ currentScene: scene }),
  setPlayerX: (x) => set({ playerX: x }),
  setFacing: (facing) => set({ facing }),
}));
