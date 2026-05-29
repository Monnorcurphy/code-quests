import { create } from 'zustand';

// Tracks which adventurers are "idle" (not on an active quest) so the
// Town Square scene can spawn wandering NPC sprites for them. Populated
// by WanderersSync (React) from the adventurers + quests queries; read
// by TownSquareScene (Phaser) via subscribe().

export interface IdleAdventurer {
  id: string;
  name: string;
}

interface WanderersState {
  idleAdventurers: IdleAdventurer[];
  setIdleAdventurers: (list: IdleAdventurer[]) => void;
}

function shallowEqualLists(a: IdleAdventurer[], b: IdleAdventurer[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].name !== b[i].name) return false;
  }
  return true;
}

export const useWanderersStore = create<WanderersState>((set, get) => ({
  idleAdventurers: [],
  setIdleAdventurers: (list) => {
    if (shallowEqualLists(get().idleAdventurers, list)) return;
    set({ idleAdventurers: list });
  },
}));
