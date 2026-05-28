import { describe, it, expect } from 'vitest';
import { QuestSchema, EpicSchema, QuestStatusSchema, InputRequestSchema, UserBlockerSchema } from '../quest';

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

  it('rejects malformed equipment (skillIds not an array)', () => {
    expect(() =>
      QuestSchema.parse({ ...valid, equipment: { skillIds: 'not-an-array' } }),
    ).toThrow();
  });

  it('defaults equipment fields when equipment is empty object', () => {
    const result = QuestSchema.parse({ ...valid, equipment: {} });
    expect(result.equipment.skillIds).toEqual([]);
    expect(result.equipment.toolIds).toEqual([]);
    expect(result.equipment.mcpServerIds).toEqual([]);
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

describe('InputRequestSchema', () => {
  it('parses a valid InputRequest with all fields', () => {
    const result = InputRequestSchema.parse({
      question: 'Which API key should I use?',
      context: 'The agent needs auth credentials.',
      awaitingSince: '2026-01-01T00:00:00Z',
      adventureFraming: 'The hero stands before the sealed gate.',
    });
    expect(result.question).toBe('Which API key should I use?');
    expect(result.adventureFraming).toBe('The hero stands before the sealed gate.');
  });

  it('parses a minimal InputRequest (required fields only)', () => {
    const result = InputRequestSchema.parse({
      question: 'What approach to use?',
      awaitingSince: '2026-05-01T12:00:00Z',
    });
    expect(result.question).toBe('What approach to use?');
    expect(result.context).toBeUndefined();
    expect(result.adventureFraming).toBeUndefined();
  });

  it('rejects empty question', () => {
    expect(() =>
      InputRequestSchema.parse({ question: '', awaitingSince: '2026-01-01T00:00:00Z' }),
    ).toThrow();
  });

  it('rejects missing question', () => {
    expect(() =>
      InputRequestSchema.parse({ awaitingSince: '2026-01-01T00:00:00Z' }),
    ).toThrow();
  });

  it('rejects missing awaitingSince', () => {
    expect(() =>
      InputRequestSchema.parse({ question: 'What next?' }),
    ).toThrow();
  });
});

describe('UserBlockerSchema', () => {
  it('parses a valid UserBlocker with all fields', () => {
    const result = UserBlockerSchema.parse({
      rawDescription: 'Waiting on design review.',
      adventureFraming: 'The hero rests at camp awaiting counsel.',
      markedAt: '2026-01-02T10:00:00Z',
      unblockedAt: '2026-01-02T15:00:00Z',
    });
    expect(result.rawDescription).toBe('Waiting on design review.');
    expect(result.unblockedAt).toBe('2026-01-02T15:00:00Z');
  });

  it('parses a minimal UserBlocker (required fields only)', () => {
    const result = UserBlockerSchema.parse({
      rawDescription: 'Waiting on legal sign-off.',
      markedAt: '2026-03-01T08:00:00Z',
    });
    expect(result.rawDescription).toBe('Waiting on legal sign-off.');
    expect(result.adventureFraming).toBeUndefined();
    expect(result.unblockedAt).toBeUndefined();
  });

  it('rejects empty rawDescription', () => {
    expect(() =>
      UserBlockerSchema.parse({ rawDescription: '', markedAt: '2026-01-01T00:00:00Z' }),
    ).toThrow();
  });

  it('rejects missing rawDescription', () => {
    expect(() =>
      UserBlockerSchema.parse({ markedAt: '2026-01-01T00:00:00Z' }),
    ).toThrow();
  });

  it('rejects missing markedAt', () => {
    expect(() =>
      UserBlockerSchema.parse({ rawDescription: 'Blocked.' }),
    ).toThrow();
  });
});

describe('QuestSchema — inputRequest and userBlocker fields', () => {
  const base = {
    id: 'q-1',
    epicId: null,
    title: 'Slay the Dragon',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    status: 'active' as const,
    adventurerId: 'adv-1',
    agentId: null,
    equipment: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('defaults inputRequest to null when omitted', () => {
    const result = QuestSchema.parse(base);
    expect(result.inputRequest).toBeNull();
  });

  it('defaults userBlocker to null when omitted', () => {
    const result = QuestSchema.parse(base);
    expect(result.userBlocker).toBeNull();
  });

  it('accepts a valid inputRequest', () => {
    const result = QuestSchema.parse({
      ...base,
      inputRequest: {
        question: 'Which path?',
        awaitingSince: '2026-01-01T00:00:00Z',
      },
    });
    expect(result.inputRequest).not.toBeNull();
    expect(result.inputRequest!.question).toBe('Which path?');
  });

  it('accepts a valid userBlocker', () => {
    const result = QuestSchema.parse({
      ...base,
      userBlocker: {
        rawDescription: 'Waiting on team feedback.',
        markedAt: '2026-01-01T00:00:00Z',
      },
    });
    expect(result.userBlocker).not.toBeNull();
    expect(result.userBlocker!.rawDescription).toBe('Waiting on team feedback.');
  });

  it('accepts explicit null for inputRequest and userBlocker', () => {
    const result = QuestSchema.parse({
      ...base,
      inputRequest: null,
      userBlocker: null,
    });
    expect(result.inputRequest).toBeNull();
    expect(result.userBlocker).toBeNull();
  });
});
