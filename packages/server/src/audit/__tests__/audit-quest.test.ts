import { describe, it, expect, vi } from 'vitest';
import { auditQuest } from '../audit-quest';
import { offlineAdapter } from '../../agents/offline-adapter';
import type { AgentAdapter } from '../../agents/adapter';
import type { Quest } from '@code-quests/shared';
import { SpecAuditSchema } from '@code-quests/shared';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'quest-1',
    epicId: null,
    projectId: null,
    title: 'Test Quest',
    description: 'A sufficiently long description that passes the minimum length requirement for testing',
    acceptanceCriteria: ['Users can log in with valid credentials', 'Invalid credentials show an error'],
    edgeCases: ['Expired session', 'Network timeout'],
    context: 'This is a detailed context for the quest providing background information.',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    equipment: { skillIds: ['linters_bane'], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    failureSummary: null,
    inputRequest: null,
    userBlocker: null,
    currentScene: 'quest-forest',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('auditQuest', () => {
  it('produces an oracle/block gap when quest has no acceptance criteria', async () => {
    const quest = makeQuest({ acceptanceCriteria: [] });
    const audit = await auditQuest(quest, offlineAdapter);
    const oracleGap = audit.gaps.find((g) => g.building === 'oracle');
    expect(oracleGap).toBeDefined();
    expect(oracleGap?.severity).toBe('block');
  });

  it('produces an oracle/block gap when all ACs are shorter than 5 chars', async () => {
    const quest = makeQuest({ acceptanceCriteria: ['ok', 'no'] });
    const audit = await auditQuest(quest, offlineAdapter);
    const oracleGap = audit.gaps.find((g) => g.building === 'oracle');
    expect(oracleGap).toBeDefined();
    expect(oracleGap?.severity).toBe('block');
  });

  it('produces a war_room/block gap when description is too short', async () => {
    const quest = makeQuest({ description: 'short' });
    const audit = await auditQuest(quest, offlineAdapter);
    const warRoomGap = audit.gaps.find((g) => g.building === 'war_room');
    expect(warRoomGap).toBeDefined();
    expect(warRoomGap?.severity).toBe('block');
  });

  it('produces a tavern/warn gap when there are no edge cases', async () => {
    const quest = makeQuest({ edgeCases: [] });
    const audit = await auditQuest(quest, offlineAdapter);
    const tavernGap = audit.gaps.find((g) => g.building === 'tavern');
    expect(tavernGap).toBeDefined();
    expect(tavernGap?.severity).toBe('warn');
  });

  it('produces an armory/warn gap when equipment is empty', async () => {
    const quest = makeQuest({ equipment: { skillIds: [], toolIds: [], mcpServerIds: [] } });
    const audit = await auditQuest(quest, offlineAdapter);
    const armoryGap = audit.gaps.find((g) => g.building === 'armory');
    expect(armoryGap).toBeDefined();
    expect(armoryGap?.severity).toBe('warn');
  });

  it('produces a library/warn gap when context is empty and description is short', async () => {
    const quest = makeQuest({
      context: '',
      description: 'A short but valid long enough quest description text',
    });
    const audit = await auditQuest(quest, offlineAdapter);
    const libraryGap = audit.gaps.find((g) => g.building === 'library');
    expect(libraryGap).toBeDefined();
    expect(libraryGap?.severity).toBe('warn');
  });

  it('returns empty gaps array for a fully-specified quest', async () => {
    const quest = makeQuest();
    const audit = await auditQuest(quest, offlineAdapter);
    expect(audit.gaps).toHaveLength(0);
  });

  it('returns a valid SpecAudit for a fully-specified quest', async () => {
    const quest = makeQuest();
    const audit = await auditQuest(quest, offlineAdapter);
    expect(() => SpecAuditSchema.parse(audit)).not.toThrow();
  });

  it('still returns deterministic gaps when adapter throws', async () => {
    const failingAdapter: AgentAdapter = {
      name: 'failing',
      complete: async () => {
        throw new Error('network failure');
      },
    };
    const quest = makeQuest({ acceptanceCriteria: [] });
    const audit = await auditQuest(quest, failingAdapter);
    const oracleGap = audit.gaps.find((g) => g.building === 'oracle');
    expect(oracleGap).toBeDefined();
    expect(oracleGap?.severity).toBe('block');
    expect(() => SpecAuditSchema.parse(audit)).not.toThrow();
  });

  it('merges valid LLM gaps with deterministic gaps', async () => {
    const llmGap = {
      building: 'guild_hall',
      reason: 'No adventurer assigned to this quest',
      severity: 'warn',
    };
    const mockAdapter: AgentAdapter = {
      name: 'mock',
      complete: async () => JSON.stringify({ gaps: [llmGap] }),
    };
    const quest = makeQuest({ edgeCases: [] });
    const audit = await auditQuest(quest, mockAdapter);
    expect(audit.gaps.some((g) => g.building === 'tavern')).toBe(true);
    expect(audit.gaps.some((g) => g.building === 'guild_hall')).toBe(true);
  });

  it('ignores invalid LLM gaps (unknown building)', async () => {
    const mockAdapter: AgentAdapter = {
      name: 'mock',
      complete: async () => JSON.stringify({ gaps: [{ building: 'unknown_place', reason: 'bad', severity: 'warn' }] }),
    };
    const quest = makeQuest();
    const audit = await auditQuest(quest, mockAdapter);
    expect(() => SpecAuditSchema.parse(audit)).not.toThrow();
  });

  it('handles malformed JSON from adapter gracefully', async () => {
    const mockAdapter: AgentAdapter = {
      name: 'mock',
      complete: async () => 'not valid json {{',
    };
    const quest = makeQuest();
    const audit = await auditQuest(quest, mockAdapter);
    expect(() => SpecAuditSchema.parse(audit)).not.toThrow();
  });

  it('sets bypassed to false by default', async () => {
    const quest = makeQuest();
    const audit = await auditQuest(quest, offlineAdapter);
    expect(audit.bypassed).toBe(false);
  });
});
