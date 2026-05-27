import { create } from 'zustand';
import type { SceneKey } from '../game/scene-registry';

interface TownState {
  currentScene: SceneKey;
  playerX: number;
  facing: 'left' | 'right';
  activeModal: 'recruit' | 'draft' | 'quest-board' | 'guild-hall' | 'coming-soon' | 'armory-loadout' | null;
  selectedQuestId: string | null;
  setScene: (scene: SceneKey) => void;
  setPlayerX: (x: number) => void;
  setFacing: (facing: 'left' | 'right') => void;
  setActiveModal: (modal: TownState['activeModal']) => void;
  setSelectedQuestId: (id: string | null) => void;
}

export const useTownStore = create<TownState>((set) => ({
  currentScene: 'boot',
  playerX: 0,
  facing: 'right',
  activeModal: null,
  selectedQuestId: null,
  setScene: (scene) => set({ currentScene: scene }),
  setPlayerX: (x) => set({ playerX: x }),
  setFacing: (facing) => set({ facing }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setSelectedQuestId: (id) => set({ selectedQuestId: id }),
}));
