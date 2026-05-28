import { create } from 'zustand';
import type { AgentEvent, QuestSceneKey, QuestStatus } from '@code-quests/shared';

const MAX_LOG_ENTRIES = 200;

interface QuestStoreState {
  entriesByQuest: Record<string, AgentEvent[]>;
  currentSceneByQuest: Record<string, QuestSceneKey>;
  statusByQuest: Record<string, QuestStatus>;
  appendEvent(questId: string, event: AgentEvent): void;
  setCurrentScene(questId: string, scene: QuestSceneKey): void;
  setStatus(questId: string, status: QuestStatus): void;
  reset(questId: string): void;
}

export const useQuestStore = create<QuestStoreState>((set) => ({
  entriesByQuest: {},
  currentSceneByQuest: {},
  statusByQuest: {},

  appendEvent(questId, event) {
    set((state) => {
      const existing = state.entriesByQuest[questId] ?? [];
      const next = [...existing, event];
      const capped = next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
      return { entriesByQuest: { ...state.entriesByQuest, [questId]: capped } };
    });
  },

  setCurrentScene(questId, scene) {
    set((state) => ({
      currentSceneByQuest: { ...state.currentSceneByQuest, [questId]: scene },
    }));
  },

  setStatus(questId, status) {
    set((state) => ({
      statusByQuest: { ...state.statusByQuest, [questId]: status },
    }));
  },

  reset(questId) {
    set((state) => {
      const { [questId]: _e, ...entriesByQuest } = state.entriesByQuest;
      const { [questId]: _s, ...currentSceneByQuest } = state.currentSceneByQuest;
      const { [questId]: _st, ...statusByQuest } = state.statusByQuest;
      return { entriesByQuest, currentSceneByQuest, statusByQuest };
    });
  },
}));
