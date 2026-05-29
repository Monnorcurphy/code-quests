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
const HAS_OPENED_LIBRARY_KEY = 'code-quests:hasOpenedLibrary';

function readHasOpenedLibrary(): boolean {
  try {
    return localStorage.getItem(HAS_OPENED_LIBRARY_KEY) === 'true';
  } catch {
    return false;
  }
}

interface TownState {
  currentScene: SceneKey;
  playerX: number;
  facing: 'left' | 'right';
  activeModal: 'recruit' | 'draft' | 'quest-board' | 'guild-hall' | 'coming-soon' | 'armory-loadout' | 'oracle' | 'library' | 'tavern' | 'hall-of-returns' | null;
  selectedQuestId: string | null;
  hasOpenedLibrary: boolean;
  libraryInitialTab: 'bestiary' | 'skills';
  setScene: (scene: SceneKey) => void;
  setPlayerX: (x: number) => void;
  setFacing: (facing: 'left' | 'right') => void;
  setActiveModal: (modal: TownState['activeModal']) => void;
  setSelectedQuestId: (id: string | null) => void;
  markLibraryOpened: () => void;
  setLibraryInitialTab: (tab: 'bestiary' | 'skills') => void;
  goToBuilding: (building: SpecGapBuilding) => void;
  goToHallOfReturns: () => void;
}

export const useTownStore = create<TownState>((set) => ({
  currentScene: 'boot',
  playerX: 0,
  facing: 'right',
  activeModal: null,
  selectedQuestId: null,
  hasOpenedLibrary: readHasOpenedLibrary(),
  libraryInitialTab: 'bestiary',
  setScene: (scene) => set({ currentScene: scene }),
  setPlayerX: (x) => set({ playerX: x }),
  setFacing: (facing) => set({ facing }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setSelectedQuestId: (id) => set({ selectedQuestId: id }),
  markLibraryOpened: () => {
    try {
      localStorage.setItem(HAS_OPENED_LIBRARY_KEY, 'true');
    } catch { /* ignore */ }
    set({ hasOpenedLibrary: true });
  },
  setLibraryInitialTab: (tab) => set({ libraryInitialTab: tab }),
  goToBuilding: (building) => {
    const sceneKey = BUILDING_SCENE_KEYS[building];
    set({ activeModal: null, currentScene: sceneKey });
    sceneRouter.emitDoorEnter({ sceneKey, spawnX: BUILDING_SPAWN_X });
  },
  goToHallOfReturns: () => {
    set({ activeModal: null, currentScene: 'hall-of-returns' });
    sceneRouter.emitDoorEnter({ sceneKey: 'hall-of-returns', spawnX: BUILDING_SPAWN_X });
  },
}));
