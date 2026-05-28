import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useEncounterStore } from '../stores/encounter-store';
import type { AgentEvent } from '@code-quests/shared';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    AUTO: 0,
    Scale: { FIT: 0, CENTER_BOTH: 0 },
  },
}));

vi.mock('../game/asset-loader', () => ({
  preloadQuestAssets: vi.fn(),
  preloadMonsterAssets: vi.fn(),
  monsterTypeIdToAssetKey: { goblin_linter: 'quest/goblin' },
  QUEST_ASSET_KEYS: {},
  ASSET_KEYS: {},
}));

const mockSpriteInstance = {
  setHp: vi.fn(),
  playVictory: vi.fn(),
  playDefeat: vi.fn(),
  playEscape: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('../game/entities/monster-sprite', () => ({
  MonsterSprite: vi.fn(() => mockSpriteInstance),
}));

import { CombatLayer } from '../game/combat-layer';

function makeScene() {
  return {
    add: {
      image: vi.fn(),
      text: vi.fn(() => ({ setOrigin: vi.fn().mockReturnThis() })),
      graphics: vi.fn(() => ({
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
    },
    tweens: { add: vi.fn() },
    cameras: { main: { shake: vi.fn(), width: 1280 } },
    time: { delayedCall: vi.fn() },
  } as unknown as import('phaser').Scene;
}

function makeAppearedEvent(overrides: Partial<Extract<AgentEvent, { type: 'monster_appeared' }>> = {}): AgentEvent {
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
  vi.clearAllMocks();
});

afterEach(() => {
  useEncounterStore.setState({ byQuest: {} });
});

describe('CombatLayer', () => {
  describe('construction', () => {
    it('subscribes to the encounter store on construction', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });
      expect(layer).toBeDefined();
      layer.destroy();
    });

    it('encounterActive is false initially', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });
      expect(layer.encounterActive).toBe(false);
      layer.destroy();
    });
  });

  describe('monster_appeared', () => {
    it('sets encounterActive to true when encounter appears', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());

      expect(layer.encounterActive).toBe(true);
      layer.destroy();
    });

    it('creates a MonsterSprite when encounter appears', async () => {
      const { MonsterSprite } = await import('../game/entities/monster-sprite');
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());

      expect(MonsterSprite).toHaveBeenCalledWith(scene, 500, 400, 'quest/goblin', 'Goblin', 1, { reducedMotion: false });
      layer.destroy();
    });

    it('uses fallback asset key when monsterTypeId is not in registry', async () => {
      const { MonsterSprite } = await import('../game/entities/monster-sprite');
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent({ monsterTypeId: 'unknown_type' }));

      expect(MonsterSprite).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(),
        'quest/silhouette-monster-small',
        expect.anything(), expect.anything(), expect.anything(),
      );
      layer.destroy();
    });

    it('passes reducedMotion option to MonsterSprite', async () => {
      const { MonsterSprite } = await import('../game/entities/monster-sprite');
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: true });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());

      expect(MonsterSprite).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), { reducedMotion: true },
      );
      layer.destroy();
    });
  });

  describe('combat (HP update)', () => {
    it('calls setHp on the sprite when combat event arrives', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeCombatEvent());

      expect(mockSpriteInstance.setHp).toHaveBeenCalledWith(75);
      layer.destroy();
    });

    it('updates setHp as HP decrements further', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeCombatEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeCombatEvent());

      const calls = mockSpriteInstance.setHp.mock.calls;
      expect(calls[calls.length - 1][0]).toBe(50);
      layer.destroy();
    });
  });

  describe('monster_resolved outcomes', () => {
    it('calls playVictory on victory', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('victory'));

      expect(mockSpriteInstance.playVictory).toHaveBeenCalledTimes(1);
      layer.destroy();
    });

    it('calls playDefeat on defeat', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('defeat'));

      expect(mockSpriteInstance.playDefeat).toHaveBeenCalledTimes(1);
      layer.destroy();
    });

    it('calls playEscape on escape', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('escape'));

      expect(mockSpriteInstance.playEscape).toHaveBeenCalledTimes(1);
      layer.destroy();
    });

    it('onComplete callback from playVictory clears the quest', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('victory'));

      const onComplete = mockSpriteInstance.playVictory.mock.calls[0][0] as () => void;
      onComplete();

      expect(useEncounterStore.getState().byQuest['q1']).toBeNull();
      expect(layer.encounterActive).toBe(false);
      layer.destroy();
    });

    it('does not play outcome animation twice if already animating', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('victory'));
      // Simulate a second resolution event while animation is in progress
      useEncounterStore.getState().handleAgentEvent('q1', makeResolvedEvent('escape'));

      expect(mockSpriteInstance.playVictory).toHaveBeenCalledTimes(1);
      expect(mockSpriteInstance.playEscape).not.toHaveBeenCalled();
      layer.destroy();
    });
  });

  describe('destroy', () => {
    it('destroys the monster sprite when layer is destroyed', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      layer.destroy();

      expect(mockSpriteInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('sets encounterActive to false after destroy', () => {
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
      expect(layer.encounterActive).toBe(true);

      layer.destroy();
      expect(layer.encounterActive).toBe(false);
    });

    it('does not respond to store updates after destroy', async () => {
      const { MonsterSprite } = await import('../game/entities/monster-sprite');
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });
      layer.destroy();
      vi.clearAllMocks();

      useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());

      expect(MonsterSprite).not.toHaveBeenCalled();
    });
  });

  describe('isolation between quest IDs', () => {
    it('does not spawn sprite for events targeting a different questId', async () => {
      const { MonsterSprite } = await import('../game/entities/monster-sprite');
      const scene = makeScene();
      const layer = new CombatLayer(scene, 'q1', { monsterX: 500, monsterY: 400, reducedMotion: false });

      useEncounterStore.getState().handleAgentEvent('q2', makeAppearedEvent());

      expect(MonsterSprite).not.toHaveBeenCalled();
      expect(layer.encounterActive).toBe(false);
      layer.destroy();
    });
  });

  describe('memory invariant', () => {
    it('encounter store byQuest does not grow unboundedly when same quest is traversed 50 times', () => {
      for (let i = 0; i < 50; i++) {
        useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());
        useEncounterStore.getState().clearQuest('q1');
      }
      expect(Object.keys(useEncounterStore.getState().byQuest).length).toBe(1);
    });

    it('encounter store stays at steady state for repeated appear/clear cycles', () => {
      const questIds = ['q1', 'q2', 'q3'];
      for (const qid of questIds) {
        useEncounterStore.getState().handleAgentEvent(qid, makeAppearedEvent());
        useEncounterStore.getState().clearQuest(qid);
      }
      expect(Object.keys(useEncounterStore.getState().byQuest).length).toBe(questIds.length);
    });
  });
});
