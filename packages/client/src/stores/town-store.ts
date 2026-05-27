import { create } from 'zustand';
import type { SceneKey } from '../game/scene-registry';
import type { SpecGapBuilding } from '@code-quests/shared';
import { sceneRouter } from '../game/scene-router';

const BUILDING_SCENE_KEYS: Record<SpecGapBuilding, SceneKey> = {
  war_room: 'war-room',
  oracle: 'oracle',
  library: 'library',
  tavern: 'tavern',
  armory: 'armory',
  guild_hall: 'guild-hall',
};

const BUILDING_SPAWN_X = 640;

interface TownState {
  currentScene: SceneKey;
  playerX: number;
  facing: 'left' | 'right';
  activeModal: 'recruit' | 'draft' | 'quest-board' | 'guild-hall' | 'coming-soon' | 'armory-loadout' | 'oracle' | 'library' | 'tavern' | null;
  selectedQuestId: string | null;
  setScene: (scene: SceneKey) => void;
  setPlayerX: (x: number) => void;
  setFacing: (facing: 'left' | 'right') => void;
  setActiveModal: (modal: TownState['activeModal']) => void;
  setSelectedQuestId: (id: string | null) => void;
  goToBuilding: (building: SpecGapBuilding) => void;
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
  goToBuilding: (building) => {
    const sceneKey = BUILDING_SCENE_KEYS[building];
    set({ activeModal: null, currentScene: sceneKey });
    sceneRouter.emitDoorEnter({ sceneKey, spawnX: BUILDING_SPAWN_X });
  },
}));
