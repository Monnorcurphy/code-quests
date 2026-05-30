import { create } from 'zustand';
import type { AdventurerClass, AdventurerStyle } from '@code-quests/shared';

export type GuildHallAdventurerStatus = 'idle' | 'on-quest';

export interface GuildHallAdventurer {
  id: string;
  name: string;
  class: AdventurerClass;
  status: GuildHallAdventurerStatus;
  /** Title of the active/blocked quest if the adventurer is dispatched. */
  currentQuestTitle: string | null;
  /** Wardrobe preferences — drives per-adventurer sprite palette. */
  style: AdventurerStyle;
}

interface GuildHallState {
  roster: GuildHallAdventurer[];
  /** Monotonic version bumped on each setRoster. Lets scenes detect changes. */
  version: number;
  setRoster: (roster: GuildHallAdventurer[]) => void;
  clear: () => void;
}

export const useGuildHallStore = create<GuildHallState>((set) => ({
  roster: [],
  version: 0,
  setRoster: (roster) =>
    set((s) => ({ roster, version: s.version + 1 })),
  clear: () =>
    set((s) => ({ roster: [], version: s.version + 1 })),
}));
