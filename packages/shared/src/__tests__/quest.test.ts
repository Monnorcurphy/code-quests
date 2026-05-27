import { describe, it, expect } from 'vitest';
import { QuestSchema, EpicSchema, QuestStatusSchema } from '../quest';

describe('QuestStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const statuses = ['idle', 'active', 'complete', 'failed', 'paused_input', 'user_blocked'];
    for (const status of statuses) {
      expect(QuestStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects an invalid status', () => {
    expect(() => QuestStatusSchema.parse('pending')).toThrow();
    expect(() => QuestStatusSchema.parse('')).toThrow();
    expect(() => QuestStatusSchema.parse(null)).toThrow();
  });
});

describe('QuestSchema', () => {
  const valid = {
    id: 'q-1',
    epicId: 'epic-1',
    title: 'Slay the Dragon',
    description: 'A dangerous quest',
    acceptanceCriteria: ['Dragon defeated'],
    edgeCases: [],
    context: 'In the mountains',
    status: 'active' as const,
    adventurerId: 'adv-1',
    agentId: null,
    equipment: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('parses a valid quest', () => {
    const result = QuestSchema.parse(valid);
    expect(result.id).toBe('q-1');
    expect(result.status).toBe('active');
  });

  it('accepts null epicId', () => {
    const result = QuestSchema.parse({ ...valid, epicId: null });
    expect(result.epicId).toBeNull();
  });

  it('accepts null adventurerId', () => {
    const result = QuestSchema.parse({ ...valid, adventurerId: null });
    expect(result.adventurerId).toBeNull();
  });

  it('defaults status to idle when omitted', () => {
    const { status: _status, ...withoutStatus } = valid;
    const result = QuestSchema.parse(withoutStatus);
    expect(result.status).toBe('idle');
  });

  it('rejects missing id', () => {
    const { id: _id, ...withoutId } = valid;
    expect(() => QuestSchema.parse(withoutId)).toThrow();
  });

  it('rejects missing title', () => {
    const { title: _title, ...withoutTitle } = valid;
    expect(() => QuestSchema.parse(withoutTitle)).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => QuestSchema.parse({ ...valid, status: 'unknown' })).toThrow();
  });

  it('rejects empty id string', () => {
    expect(() => QuestSchema.parse({ ...valid, id: '' })).toThrow();
  });
});

describe('EpicSchema', () => {
  const valid = {
    id: 'epic-1',
    title: 'Conquer the Dark Tower',
    goal: 'Defeat the Lich King',
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('parses a valid epic', () => {
    const result = EpicSchema.parse(valid);
    expect(result.id).toBe('epic-1');
    expect(result.title).toBe('Conquer the Dark Tower');
  });

  it('rejects missing id', () => {
    const { id: _id, ...withoutId } = valid;
    expect(() => EpicSchema.parse(withoutId)).toThrow();
  });

  it('rejects missing title', () => {
    const { title: _title, ...withoutTitle } = valid;
    expect(() => EpicSchema.parse(withoutTitle)).toThrow();
  });

  it('rejects missing goal', () => {
    const { goal: _goal, ...withoutGoal } = valid;
    expect(() => EpicSchema.parse(withoutGoal)).toThrow();
  });

  it('rejects empty title', () => {
    expect(() => EpicSchema.parse({ ...valid, title: '' })).toThrow();
  });
});
