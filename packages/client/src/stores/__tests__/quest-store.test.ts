import { describe, it, expect, beforeEach } from 'vitest';
import { useQuestStore } from '../quest-store';
import type { AgentEvent } from '@code-quests/shared';

function makeProgressEvent(msg: string): AgentEvent {
  return { type: 'progress', timestamp: new Date().toISOString(), message: msg };
}

beforeEach(() => {
  useQuestStore.setState({
    entriesByQuest: {},
    currentSceneByQuest: {},
    statusByQuest: {},
  });
});

describe('useQuestStore', () => {
  describe('appendEvent', () => {
    it('appends an event to an empty quest log', () => {
      const store = useQuestStore.getState();
      store.appendEvent('q1', makeProgressEvent('hello'));
      expect(useQuestStore.getState().entriesByQuest['q1']).toHaveLength(1);
    });

    it('appends multiple events in order', () => {
      const store = useQuestStore.getState();
      store.appendEvent('q1', makeProgressEvent('first'));
      store.appendEvent('q1', makeProgressEvent('second'));
      const entries = useQuestStore.getState().entriesByQuest['q1'];
      expect(entries).toHaveLength(2);
      expect((entries[0] as { message: string }).message).toBe('first');
      expect((entries[1] as { message: string }).message).toBe('second');
    });

    it('caps at 200 entries — drops oldest', () => {
      const store = useQuestStore.getState();
      for (let i = 0; i < 205; i++) {
        store.appendEvent('q1', makeProgressEvent(`msg-${i}`));
      }
      const entries = useQuestStore.getState().entriesByQuest['q1'];
      expect(entries).toHaveLength(200);
      // oldest entries dropped; newest retained
      expect((entries[entries.length - 1] as { message: string }).message).toBe('msg-204');
      expect((entries[0] as { message: string }).message).toBe('msg-5');
    });

    it('keeps separate logs per questId', () => {
      const store = useQuestStore.getState();
      store.appendEvent('q1', makeProgressEvent('q1 event'));
      store.appendEvent('q2', makeProgressEvent('q2 event'));
      expect(useQuestStore.getState().entriesByQuest['q1']).toHaveLength(1);
      expect(useQuestStore.getState().entriesByQuest['q2']).toHaveLength(1);
    });
  });

  describe('setCurrentScene', () => {
    it('stores the current scene for a quest', () => {
      useQuestStore.getState().setCurrentScene('q1', 'quest-cave');
      expect(useQuestStore.getState().currentSceneByQuest['q1']).toBe('quest-cave');
    });

    it('updates the scene on subsequent calls', () => {
      const store = useQuestStore.getState();
      store.setCurrentScene('q1', 'quest-cave');
      store.setCurrentScene('q1', 'quest-dungeon');
      expect(useQuestStore.getState().currentSceneByQuest['q1']).toBe('quest-dungeon');
    });
  });

  describe('setStatus', () => {
    it('stores the status for a quest', () => {
      useQuestStore.getState().setStatus('q1', 'active');
      expect(useQuestStore.getState().statusByQuest['q1']).toBe('active');
    });

    it('updates status on subsequent calls', () => {
      const store = useQuestStore.getState();
      store.setStatus('q1', 'active');
      store.setStatus('q1', 'complete');
      expect(useQuestStore.getState().statusByQuest['q1']).toBe('complete');
    });
  });

  describe('reset', () => {
    it('removes all data for the given questId', () => {
      const store = useQuestStore.getState();
      store.appendEvent('q1', makeProgressEvent('event'));
      store.setCurrentScene('q1', 'quest-cave');
      store.setStatus('q1', 'active');

      store.reset('q1');

      const state = useQuestStore.getState();
      expect(state.entriesByQuest['q1']).toBeUndefined();
      expect(state.currentSceneByQuest['q1']).toBeUndefined();
      expect(state.statusByQuest['q1']).toBeUndefined();
    });

    it('does not affect other quest IDs', () => {
      const store = useQuestStore.getState();
      store.appendEvent('q1', makeProgressEvent('q1'));
      store.appendEvent('q2', makeProgressEvent('q2'));

      store.reset('q1');

      expect(useQuestStore.getState().entriesByQuest['q2']).toHaveLength(1);
    });
  });
});
