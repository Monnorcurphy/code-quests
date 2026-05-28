import { describe, it, expect, beforeEach } from 'vitest';
import { useEncounterStore } from '../encounter-store';
import type { AgentEvent } from '@code-quests/shared';

function makeAppearedEvent(
  overrides?: Partial<Extract<AgentEvent, { type: 'monster_appeared' }>>,
): AgentEvent {
  return {
    type: 'monster_appeared',
    timestamp: new Date().toISOString(),
    encounterId: 'enc-1',
    monsterId: 'mon-1',
    monsterName: 'Goblin',
    monsterTypeId: 'goblin_linter',
    spritePath: 'monsters/goblin.png',
    difficulty: 1,
    ...overrides,
  };
}

function makeCombatEvent(): AgentEvent {
  return { type: 'combat', timestamp: new Date().toISOString(), message: 'strike' };
}

function makeResolvedEvent(outcome: 'victory' | 'defeat' | 'escape'): AgentEvent {
  return {
    type: 'monster_resolved',
    timestamp: new Date().toISOString(),
    encounterId: 'enc-1',
    outcome,
  };
}

beforeEach(() => {
  useEncounterStore.setState({ byQuest: {} });
});

describe('useEncounterStore', () => {
  describe('monster_appeared', () => {
    it('creates an encounter with hp=100 and outcome=pending', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      const enc = useEncounterStore.getState().byQuest['q1'];
      expect(enc).not.toBeNull();
      expect(enc?.hp).toBe(100);
      expect(enc?.outcome).toBe('pending');
    });

    it('stores all fields from the event', () => {
      useEncounterStore.getState().handleAgentEvent(
        'q1',
        makeAppearedEvent({
          encounterId: 'enc-99',
          monsterId: 'mon-99',
          monsterName: 'Dragon',
          monsterTypeId: 'dragon_epic_obstacle',
          spritePath: 'monsters/dragon.png',
          difficulty: 5,
        }),
      );
      const enc = useEncounterStore.getState().byQuest['q1'];
      expect(enc?.encounterId).toBe('enc-99');
      expect(enc?.monsterId).toBe('mon-99');
      expect(enc?.monsterName).toBe('Dragon');
      expect(enc?.monsterTypeId).toBe('dragon_epic_obstacle');
      expect(enc?.spritePath).toBe('monsters/dragon.png');
      expect(enc?.difficulty).toBe(5);
    });

    it('keeps separate encounters per questId', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent({ monsterName: 'Goblin' }));
      useEncounterStore
        .getState()
        .handleAgentEvent('q2', makeAppearedEvent({ monsterName: 'Lich', monsterTypeId: 'lich_repeated_failure' }));
      expect(useEncounterStore.getState().byQuest['q1']?.monsterName).toBe('Goblin');
      expect(useEncounterStore.getState().byQuest['q2']?.monsterName).toBe('Lich');
    });

    it('replaces an existing encounter for the same quest', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent({ monsterName: 'Goblin' }));
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent({ monsterName: 'Ogre' }));
      expect(useEncounterStore.getState().byQuest['q1']?.monsterName).toBe('Ogre');
      expect(useEncounterStore.getState().byQuest['q1']?.hp).toBe(100);
    });
  });

  describe('combat', () => {
    it('decrements hp by 25', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeCombatEvent());
      expect(useEncounterStore.getState().byQuest['q1']?.hp).toBe(75);
    });

    it('accumulates multiple combat hits', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      const store = useEncounterStore.getState();
      store.handleAgentEvent('q1', makeCombatEvent());
      store.handleAgentEvent('q1', makeCombatEvent());
      expect(useEncounterStore.getState().byQuest['q1']?.hp).toBe(50);
    });

    it('clamps hp at 0 — never goes negative', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      const store = useEncounterStore.getState();
      for (let i = 0; i < 6; i++) {
        store.handleAgentEvent('q1', makeCombatEvent());
      }
      expect(useEncounterStore.getState().byQuest['q1']?.hp).toBe(0);
    });

    it('does nothing if no active encounter for the quest', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeCombatEvent());
      expect(useEncounterStore.getState().byQuest['q1']).toBeUndefined();
    });
  });

  describe('monster_resolved', () => {
    it('sets outcome to victory', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('victory'));
      expect(useEncounterStore.getState().byQuest['q1']?.outcome).toBe('victory');
    });

    it('sets outcome to defeat', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('defeat'));
      expect(useEncounterStore.getState().byQuest['q1']?.outcome).toBe('defeat');
    });

    it('sets outcome to escape', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('escape'));
      expect(useEncounterStore.getState().byQuest['q1']?.outcome).toBe('escape');
    });

    it('does nothing if no active encounter for the quest', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('victory'));
      expect(useEncounterStore.getState().byQuest['q1']).toBeUndefined();
    });

    it('does not affect other quest IDs', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q2', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('victory'));
      expect(useEncounterStore.getState().byQuest['q2']?.outcome).toBe('pending');
    });
  });

  describe('clearQuest', () => {
    it('sets the encounter to null', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().clearQuest('q1');
      expect(useEncounterStore.getState().byQuest['q1']).toBeNull();
    });

    it('does not affect other quest IDs', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q2', makeAppearedEvent({ monsterName: 'Dragon' }));
      useEncounterStore.getState().clearQuest('q1');
      expect(useEncounterStore.getState().byQuest['q2']?.monsterName).toBe('Dragon');
    });

    it('sets null even if no encounter was active', () => {
      useEncounterStore.getState().clearQuest('q1');
      expect(useEncounterStore.getState().byQuest['q1']).toBeNull();
    });
  });

  describe('hp invariants', () => {
    it('hp never exceeds 100 after monster_appeared', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      expect(useEncounterStore.getState().byQuest['q1']?.hp).toBeLessThanOrEqual(100);
    });

    it('hp never goes below 0 regardless of combat hits', () => {
      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      const store = useEncounterStore.getState();
      for (let i = 0; i < 20; i++) {
        store.handleAgentEvent('q1', makeCombatEvent());
      }
      expect(useEncounterStore.getState().byQuest['q1']?.hp).toBeGreaterThanOrEqual(0);
    });
  });
});
