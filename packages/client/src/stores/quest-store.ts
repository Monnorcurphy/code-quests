import { create } from 'zustand';
import type { AgentEvent, QuestSceneKey, QuestStatus, InputRequest, UserBlocker } from '@code-quests/shared';

const MAX_LOG_ENTRIES = 200;

export type StoredEvent = AgentEvent & { _id: number };

interface QuestStoreState {
  _nextId: number;
  entriesByQuest: Record<string, StoredEvent[]>;
  currentSceneByQuest: Record<string, QuestSceneKey>;
  statusByQuest: Record<string, QuestStatus>;
  inputRequestByQuest: Record<string, InputRequest | null>;
  userBlockerByQuest: Record<string, UserBlocker | null>;
  appendEvent(questId: string, event: AgentEvent): void;
  setCurrentScene(questId: string, scene: QuestSceneKey): void;
  setStatus(questId: string, status: QuestStatus): void;
  setInputRequest(questId: string, req: InputRequest): void;
  clearInputRequest(questId: string): void;
  setUserBlocker(questId: string, blocker: UserBlocker): void;
  clearUserBlocker(questId: string): void;
  reset(questId: string): void;
}

export const useQuestStore = create<QuestStoreState>((set) => ({
  _nextId: 0,
  entriesByQuest: {},
  currentSceneByQuest: {},
  statusByQuest: {},
  inputRequestByQuest: {},
  userBlockerByQuest: {},

  appendEvent(questId, event) {
    set((state) => {
      const stored: StoredEvent = { ...event, _id: state._nextId };
      const existing = state.entriesByQuest[questId] ?? [];
      const next = [...existing, stored];
      const capped = next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
      return {
        _nextId: state._nextId + 1,
        entriesByQuest: { ...state.entriesByQuest, [questId]: capped },
      };
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

  setInputRequest(questId, req) {
    set((state) => ({
      inputRequestByQuest: { ...state.inputRequestByQuest, [questId]: req },
    }));
  },

  clearInputRequest(questId) {
    set((state) => ({
      inputRequestByQuest: { ...state.inputRequestByQuest, [questId]: null },
    }));
  },

  setUserBlocker(questId, blocker) {
    set((state) => ({
      userBlockerByQuest: { ...state.userBlockerByQuest, [questId]: blocker },
    }));
  },

  clearUserBlocker(questId) {
    set((state) => ({
      userBlockerByQuest: { ...state.userBlockerByQuest, [questId]: null },
    }));
  },

  reset(questId) {
    set((state) => {
      const { [questId]: _e, ...entriesByQuest } = state.entriesByQuest;
      const { [questId]: _s, ...currentSceneByQuest } = state.currentSceneByQuest;
      const { [questId]: _st, ...statusByQuest } = state.statusByQuest;
      const { [questId]: _ir, ...inputRequestByQuest } = state.inputRequestByQuest;
      const { [questId]: _ub, ...userBlockerByQuest } = state.userBlockerByQuest;
      return { entriesByQuest, currentSceneByQuest, statusByQuest, inputRequestByQuest, userBlockerByQuest };
    });
  },
}));
