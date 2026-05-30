import { describe, it, expect } from 'vitest';
import { mintScar } from '../scar';
import type { Quest, Adventurer, FailureSummary, ScarRecord } from '@code-quests/shared';

function makeQuest(id = 'q-1'): Quest {
  return {
    id,
    epicId: null,
    projectId: null,
    title: 'Test Quest',
    description: 'A test quest',
    acceptanceCriteria: [],
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
  };
}

function makeAdventurer(overrides: Partial<Adventurer> & { id: string }): Adventurer {
  return {
    name: 'Test Adventurer',
    class: 'ranger',
    modelId: 'claude-haiku',
    createdAt: '2024-01-01T00:00:00.000Z',
    stats: {},
    specializations: [],
    scars: [],
    style: {},
    ...overrides,
  };
}

function makeFailureSummary(
  recommendation: FailureSummary['recommendation'],
  notes = 'The adventurer was defeated. A critical failure. The quest is over.',
): FailureSummary {
  return {
    fatalEncounterId: 'enc-1',
    retries: 1,
    recommendation,
    notes,
    reason: '',
  };
}

const CTX = { fatalMonsterId: 'monster-1', lifetimeQuestCount: 5 };

describe('mintScar', () => {
  describe('returns null (no scar) cases', () => {
    it('returns null when recommendation is repost_with_clarification', () => {
      const quest = makeQuest();
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('repost_with_clarification');
      expect(mintScar(quest, adventurer, failureSummary, CTX)).toBeNull();
    });

    it('returns null for first failure with < 3 lifetime quests (grace period)', () => {
      const quest = makeQuest();
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('retire');
      expect(mintScar(quest, adventurer, failureSummary, { fatalMonsterId: 'm-1', lifetimeQuestCount: 2 })).toBeNull();
    });

    it('grants grace period when lifetimeQuestCount is 0', () => {
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('retire');
      expect(mintScar(makeQuest(), adventurer, failureSummary, { fatalMonsterId: 'm-1', lifetimeQuestCount: 0 })).toBeNull();
    });

    it('grants grace period when lifetimeQuestCount is exactly 2', () => {
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('level_up_first');
      expect(mintScar(makeQuest(), adventurer, failureSummary, { fatalMonsterId: 'm-1', lifetimeQuestCount: 2 })).toBeNull();
    });
  });

  describe('mints a scar', () => {
    it('mints a scar for retire recommendation with sufficient lifetime quests', () => {
      const quest = makeQuest('q-target');
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('retire');
      const scar = mintScar(quest, adventurer, failureSummary, CTX);
      expect(scar).not.toBeNull();
      expect(scar?.questId).toBe('q-target');
      expect(scar?.monsterIdAtFatal).toBe('monster-1');
    });

    it('mints a scar for level_up_first recommendation', () => {
      const quest = makeQuest();
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('level_up_first');
      const scar = mintScar(quest, adventurer, failureSummary, CTX);
      expect(scar).not.toBeNull();
      expect(scar?.monsterIdAtFatal).toBe('monster-1');
    });

    it('mints a scar for break_into_smaller recommendation', () => {
      const quest = makeQuest();
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('break_into_smaller');
      const scar = mintScar(quest, adventurer, failureSummary, CTX);
      expect(scar).not.toBeNull();
    });

    it('does not apply grace period when adventurer already has scars', () => {
      const quest = makeQuest();
      const existingScar: ScarRecord = {
        questId: 'q-old',
        failureSummary: 'Previous failure.',
        monsterIdAtFatal: 'monster-old',
        occurredAt: '2024-01-01T00:00:00.000Z',
      };
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [existingScar] });
      const failureSummary = makeFailureSummary('retire');
      const scar = mintScar(quest, adventurer, failureSummary, { fatalMonsterId: 'm-1', lifetimeQuestCount: 1 });
      expect(scar).not.toBeNull();
    });

    it('does not apply grace period when lifetimeQuestCount is exactly 3', () => {
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('retire');
      const scar = mintScar(makeQuest(), adventurer, failureSummary, { fatalMonsterId: 'm-1', lifetimeQuestCount: 3 });
      expect(scar).not.toBeNull();
    });
  });

  describe('scar fields', () => {
    it('failureSummary is the first sentence of notes', () => {
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const notes = 'First sentence of the notes. Second sentence here. Third sentence.';
      const failureSummary = makeFailureSummary('retire', notes);
      const scar = mintScar(makeQuest(), adventurer, failureSummary, CTX);
      expect(scar?.failureSummary).toBe('First sentence of the notes.');
    });

    it('sets occurredAt to a valid ISO timestamp', () => {
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('retire');
      const scar = mintScar(makeQuest(), adventurer, failureSummary, CTX);
      expect(() => new Date(scar!.occurredAt)).not.toThrow();
      expect(scar?.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('falls back gracefully when notes has no period', () => {
      const adventurer = makeAdventurer({ id: 'adv-1', scars: [] });
      const failureSummary = makeFailureSummary('retire', 'No period in this notes string');
      const scar = mintScar(makeQuest(), adventurer, failureSummary, CTX);
      expect(scar?.failureSummary).toBe('No period in this notes string');
    });
  });

  describe('stats-based lifetime quest fallback', () => {
    it('uses questsWon + questsLost from stats when lifetimeQuestCount is 0', () => {
      const adventurer = makeAdventurer({
        id: 'adv-1',
        scars: [],
        stats: { questsWon: 2, questsLost: 1 },
      });
      const failureSummary = makeFailureSummary('retire');
      const scar = mintScar(makeQuest(), adventurer, failureSummary, { fatalMonsterId: 'm-1', lifetimeQuestCount: 0 });
      expect(scar).not.toBeNull();
    });
  });
});
