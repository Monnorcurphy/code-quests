import { describe, it, expect } from 'vitest';
import { QuestSchema, AdventurerSchema } from './index';

describe('QuestSchema (re-exported from index)', () => {
  it('parses a valid quest', () => {
    const quest = QuestSchema.parse({
      id: '1',
      epicId: null,
      title: 'Slay the Dragon',
      status: 'active',
      adventurerId: null,
      agentId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(quest.status).toBe('active');
  });
});

describe('AdventurerSchema (re-exported from index)', () => {
  it('parses a valid adventurer', () => {
    const adventurer = AdventurerSchema.parse({
      id: '1',
      name: 'Aria',
      class: 'ranger',
      modelId: 'claude-sonnet-4-6',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(adventurer.class).toBe('ranger');
  });
});
