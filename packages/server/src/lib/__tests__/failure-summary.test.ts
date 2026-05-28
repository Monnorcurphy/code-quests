import { describe, it, expect } from 'vitest';
import { buildFailureSummary } from '../failure-summary';
import type { Quest, Agent, MonsterEncounter } from '@code-quests/shared';

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-1',
    epicId: null,
    title: 'Test Quest',
    description: 'A test quest description',
    acceptanceCriteria: ['Criterion A'],
    edgeCases: [],
    context: '',
    status: 'failed',
    adventurerId: 'adv-1',
    agentId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    failureSummary: null,
    currentScene: 'quest-forest',
    inputRequest: null,
    userBlocker: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAgent(id: string): Agent {
  return {
    id,
    adventurerId: 'adv-1',
    questId: 'q-1',
    startedAt: '2024-01-01T00:00:00.000Z',
    endedAt: '2024-01-01T01:00:00.000Z',
    pid: null,
    exitCode: 1,
  };
}

function makeEncounter(
  id: string,
  opts: {
    outcome: 'victory' | 'defeat' | 'escape';
    monsterTypeId?: string;
    monsterName?: string;
    appearedAt?: string;
  },
): MonsterEncounter {
  return {
    id,
    monsterId: `monster-${id}`,
    questId: 'q-1',
    appearedAt: opts.appearedAt ?? '2024-01-01T00:30:00.000Z',
    combatLog: [],
    outcome: opts.outcome,
    loot: [],
    monsterTypeId: opts.monsterTypeId,
    monsterName: opts.monsterName ?? 'Test Monster',
  };
}

describe('buildFailureSummary', () => {
  describe('fatalEncounterId', () => {
    it('returns empty string when no defeat encounters exist', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1')];
      const encounters = [makeEncounter('enc-1', { outcome: 'escape' })];
      const result = buildFailureSummary(quest, agents, encounters);
      expect(result.fatalEncounterId).toBe('');
    });

    it('returns the id of the most recent defeat encounter', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1')];
      const encounters = [
        makeEncounter('enc-1', { outcome: 'defeat', appearedAt: '2024-01-01T00:10:00.000Z' }),
        makeEncounter('enc-2', { outcome: 'defeat', appearedAt: '2024-01-01T00:30:00.000Z' }),
        makeEncounter('enc-3', { outcome: 'escape', appearedAt: '2024-01-01T00:40:00.000Z' }),
      ];
      const result = buildFailureSummary(quest, agents, encounters);
      expect(result.fatalEncounterId).toBe('enc-2');
    });
  });

  describe('retries', () => {
    it('equals the number of agents', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1'), makeAgent('ag-2'), makeAgent('ag-3')];
      const result = buildFailureSummary(quest, agents, []);
      expect(result.retries).toBe(3);
    });

    it('is zero when no agents exist', () => {
      const result = buildFailureSummary(makeQuest(), [], []);
      expect(result.retries).toBe(0);
    });
  });

  describe('recommendation: level_up_first', () => {
    it('returns level_up_first for ≥ 3 retries with same monster type in each defeat', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1'), makeAgent('ag-2'), makeAgent('ag-3')];
      const encounters = [
        makeEncounter('enc-1', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
        makeEncounter('enc-2', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
        makeEncounter('enc-3', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
      ];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).toBe('level_up_first');
    });

    it('does NOT return level_up_first when defeat types differ', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1'), makeAgent('ag-2'), makeAgent('ag-3')];
      const encounters = [
        makeEncounter('enc-1', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
        makeEncounter('enc-2', { outcome: 'defeat', monsterTypeId: 'imp_typecheck' }),
        makeEncounter('enc-3', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
      ];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).not.toBe('level_up_first');
    });

    it('does NOT return level_up_first when fewer than 3 retries', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1'), makeAgent('ag-2')];
      const encounters = [
        makeEncounter('enc-1', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
        makeEncounter('enc-2', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
      ];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).not.toBe('level_up_first');
    });
  });

  describe('recommendation: break_into_smaller', () => {
    it('returns break_into_smaller for ≥ 2 Hydra encounters', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1')];
      const encounters = [
        makeEncounter('enc-1', { outcome: 'defeat', monsterTypeId: 'hydra_ac_mismatch' }),
        makeEncounter('enc-2', { outcome: 'escape', monsterTypeId: 'hydra_ac_mismatch' }),
      ];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).toBe('break_into_smaller');
    });

    it('does NOT return break_into_smaller for a single Hydra encounter', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1')];
      const encounters = [
        makeEncounter('enc-1', { outcome: 'defeat', monsterTypeId: 'hydra_ac_mismatch' }),
      ];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).not.toBe('break_into_smaller');
    });

    it('takes priority over level_up_first when Hydra count triggers it', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1'), makeAgent('ag-2'), makeAgent('ag-3')];
      const encounters = [
        makeEncounter('enc-1', { outcome: 'defeat', monsterTypeId: 'hydra_ac_mismatch' }),
        makeEncounter('enc-2', { outcome: 'defeat', monsterTypeId: 'hydra_ac_mismatch' }),
        makeEncounter('enc-3', { outcome: 'defeat', monsterTypeId: 'hydra_ac_mismatch' }),
      ];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).toBe('break_into_smaller');
    });
  });

  describe('recommendation: repost_with_clarification', () => {
    it('returns repost_with_clarification for 1 attempt and 1 fatal encounter', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1')];
      const encounters = [makeEncounter('enc-1', { outcome: 'defeat' })];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).toBe('repost_with_clarification');
    });

    it('returns repost_with_clarification when no defeats and 1 attempt', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1')];
      const encounters = [makeEncounter('enc-1', { outcome: 'escape' })];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).toBe('repost_with_clarification');
    });
  });

  describe('recommendation: retire', () => {
    it('returns retire as the default fallback', () => {
      const quest = makeQuest();
      const agents = [makeAgent('ag-1'), makeAgent('ag-2')];
      const encounters = [
        makeEncounter('enc-1', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
        makeEncounter('enc-2', { outcome: 'escape', monsterTypeId: 'imp_typecheck' }),
      ];
      expect(buildFailureSummary(quest, agents, encounters).recommendation).toBe('retire');
    });

    it('returns retire when no agents and no encounters', () => {
      expect(buildFailureSummary(makeQuest(), [], []).recommendation).toBe('repost_with_clarification');
    });
  });

  describe('notes', () => {
    it('generates a non-empty notes string for every recommendation', () => {
      const quest = makeQuest();
      const scenarios: Array<{ agents: Agent[]; encounters: MonsterEncounter[] }> = [
        {
          agents: [makeAgent('a'), makeAgent('b'), makeAgent('c')],
          encounters: [
            makeEncounter('e1', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
            makeEncounter('e2', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
            makeEncounter('e3', { outcome: 'defeat', monsterTypeId: 'ogre_failing_test' }),
          ],
        },
        {
          agents: [makeAgent('a')],
          encounters: [
            makeEncounter('e1', { outcome: 'defeat', monsterTypeId: 'hydra_ac_mismatch' }),
            makeEncounter('e2', { outcome: 'defeat', monsterTypeId: 'hydra_ac_mismatch' }),
          ],
        },
        {
          agents: [makeAgent('a')],
          encounters: [makeEncounter('e1', { outcome: 'defeat' })],
        },
        {
          agents: [makeAgent('a'), makeAgent('b')],
          encounters: [makeEncounter('e1', { outcome: 'defeat' }), makeEncounter('e2', { outcome: 'escape' })],
        },
      ];
      for (const s of scenarios) {
        const result = buildFailureSummary(quest, s.agents, s.encounters);
        expect(result.notes?.length ?? 0).toBeGreaterThan(0);
      }
    });

    it('includes the quest title in the notes', () => {
      const quest = makeQuest({ title: 'Unique Quest Title' });
      const result = buildFailureSummary(quest, [makeAgent('a')], []);
      expect(result.notes).toContain('Unique Quest Title');
    });
  });
});
