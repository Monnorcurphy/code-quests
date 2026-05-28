import { create } from 'zustand';
import type { AgentEvent } from '@code-quests/shared';

const HP_INITIAL = 100;
const HP_COMBAT_DECREMENT = 25;

export interface ActiveEncounter {
  encounterId: string;
  monsterId: string;
  monsterName: string;
  monsterTypeId: string;
  spritePath: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  hp: number;
  outcome: 'pending' | 'victory' | 'defeat' | 'escape';
}

interface EncounterStore {
  byQuest: Record<string, ActiveEncounter | null>;
  handleAgentEvent(questId: string, event: AgentEvent): void;
  clearQuest(questId: string): void;
}

export const useEncounterStore = create<EncounterStore>((set) => ({
  byQuest: {},

  handleAgentEvent(questId, event) {
    if (event.type === 'monster_appeared') {
      set((state) => ({
        byQuest: {
          ...state.byQuest,
          [questId]: {
            encounterId: event.encounterId,
            monsterId: event.monsterId,
            monsterName: event.monsterName,
            monsterTypeId: event.monsterTypeId,
            spritePath: event.spritePath,
            difficulty: event.difficulty as ActiveEncounter['difficulty'],
            hp: HP_INITIAL,
            outcome: 'pending',
          },
        },
      }));
      return;
    }

    if (event.type === 'combat') {
      set((state) => {
        const current = state.byQuest[questId];
        if (!current) return state;
        return {
          byQuest: {
            ...state.byQuest,
            [questId]: { ...current, hp: Math.max(0, current.hp - HP_COMBAT_DECREMENT) },
          },
        };
      });
      return;
    }

    if (event.type === 'monster_resolved') {
      set((state) => {
        const current = state.byQuest[questId];
        if (!current) return state;
        return {
          byQuest: {
            ...state.byQuest,
            [questId]: { ...current, outcome: event.outcome },
          },
        };
      });
    }
  },

  clearQuest(questId) {
    set((state) => ({
      byQuest: { ...state.byQuest, [questId]: null },
    }));
  },
}));
