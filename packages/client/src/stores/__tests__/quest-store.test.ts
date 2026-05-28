import { describe, it, expect, beforeEach } from 'vitest';
import { useQuestStore } from '../quest-store';
import type { AgentEvent, InputRequest, UserBlocker } from '@code-quests/shared';

function makeProgressEvent(msg: string): AgentEvent {
  return { type: 'progress', timestamp: new Date().toISOString(), message: msg };
}

function makeInputRequest(overrides: Partial<InputRequest> = {}): InputRequest {
  return {
    question: 'What should I do?',
    awaitingSince: new Date().toISOString(),
    ...overrides,
  };
}

function makeUserBlocker(overrides: Partial<UserBlocker> = {}): UserBlocker {
  return {
    rawDescription: 'User is blocked by external dependency',
    markedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  useQuestStore.setState({
    _nextId: 0,
    entriesByQuest: {},
    currentSceneByQuest: {},
    statusByQuest: {},
    inputRequestByQuest: {},
    userBlockerByQuest: {},
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

  describe('setInputRequest / clearInputRequest', () => {
    it('sets inputRequest for a quest', () => {
      const req = makeInputRequest({ question: 'Proceed with option A or B?' });
      useQuestStore.getState().setInputRequest('q1', req);
      expect(useQuestStore.getState().inputRequestByQuest['q1']).toEqual(req);
    });

    it('clears inputRequest to null', () => {
      const req = makeInputRequest();
      useQuestStore.getState().setInputRequest('q1', req);
      useQuestStore.getState().clearInputRequest('q1');
      expect(useQuestStore.getState().inputRequestByQuest['q1']).toBeNull();
    });

    it('keeps separate inputRequest per questId', () => {
      useQuestStore.getState().setInputRequest('q1', makeInputRequest({ question: 'Q1?' }));
      useQuestStore.getState().setInputRequest('q2', makeInputRequest({ question: 'Q2?' }));
      expect(useQuestStore.getState().inputRequestByQuest['q1']?.question).toBe('Q1?');
      expect(useQuestStore.getState().inputRequestByQuest['q2']?.question).toBe('Q2?');
    });

    it('clearing one quest does not affect another', () => {
      useQuestStore.getState().setInputRequest('q1', makeInputRequest());
      useQuestStore.getState().setInputRequest('q2', makeInputRequest());
      useQuestStore.getState().clearInputRequest('q1');
      expect(useQuestStore.getState().inputRequestByQuest['q1']).toBeNull();
      expect(useQuestStore.getState().inputRequestByQuest['q2']).not.toBeNull();
    });
  });

  describe('setUserBlocker / clearUserBlocker', () => {
    it('sets userBlocker for a quest', () => {
      const blocker = makeUserBlocker({ rawDescription: 'Waiting for API key' });
      useQuestStore.getState().setUserBlocker('q1', blocker);
      expect(useQuestStore.getState().userBlockerByQuest['q1']).toEqual(blocker);
    });

    it('clears userBlocker to null', () => {
      const blocker = makeUserBlocker();
      useQuestStore.getState().setUserBlocker('q1', blocker);
      useQuestStore.getState().clearUserBlocker('q1');
      expect(useQuestStore.getState().userBlockerByQuest['q1']).toBeNull();
    });

    it('keeps separate userBlocker per questId', () => {
      useQuestStore.getState().setUserBlocker('q1', makeUserBlocker({ rawDescription: 'Blocker A' }));
      useQuestStore.getState().setUserBlocker('q2', makeUserBlocker({ rawDescription: 'Blocker B' }));
      expect(useQuestStore.getState().userBlockerByQuest['q1']?.rawDescription).toBe('Blocker A');
      expect(useQuestStore.getState().userBlockerByQuest['q2']?.rawDescription).toBe('Blocker B');
    });
  });

  describe('reset', () => {
    it('removes all data for the given questId', () => {
      const store = useQuestStore.getState();
      store.appendEvent('q1', makeProgressEvent('event'));
      store.setCurrentScene('q1', 'quest-cave');
      store.setStatus('q1', 'active');
      store.setInputRequest('q1', makeInputRequest());
      store.setUserBlocker('q1', makeUserBlocker());

      store.reset('q1');

      const state = useQuestStore.getState();
      expect(state.entriesByQuest['q1']).toBeUndefined();
      expect(state.currentSceneByQuest['q1']).toBeUndefined();
      expect(state.statusByQuest['q1']).toBeUndefined();
      expect(state.inputRequestByQuest['q1']).toBeUndefined();
      expect(state.userBlockerByQuest['q1']).toBeUndefined();
    });

    it('does not affect other quest IDs', () => {
      const store = useQuestStore.getState();
      store.appendEvent('q1', makeProgressEvent('q1'));
      store.appendEvent('q2', makeProgressEvent('q2'));
      store.setInputRequest('q2', makeInputRequest());
      store.setUserBlocker('q2', makeUserBlocker());

      store.reset('q1');

      expect(useQuestStore.getState().entriesByQuest['q2']).toHaveLength(1);
      expect(useQuestStore.getState().inputRequestByQuest['q2']).not.toBeUndefined();
      expect(useQuestStore.getState().userBlockerByQuest['q2']).not.toBeUndefined();
    });
  });
});
