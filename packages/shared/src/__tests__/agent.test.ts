import { describe, it, expect } from 'vitest';
import { AgentEventSchema } from '../agent';

describe('AgentEventSchema — paused_input variant', () => {
  it('parses a valid paused_input event', () => {
    const event = AgentEventSchema.parse({
      type: 'paused_input',
      timestamp: '2026-01-01T00:00:00Z',
      question: 'Should I use approach A or approach B?',
    });
    expect(event.type).toBe('paused_input');
    if (event.type !== 'paused_input') throw new Error('wrong type');
    expect(event.question).toBe('Should I use approach A or approach B?');
  });

  it('parses paused_input with optional context', () => {
    const event = AgentEventSchema.parse({
      type: 'paused_input',
      timestamp: '2026-01-01T00:00:00Z',
      question: 'Which database to use?',
      context: 'The schema has 50M rows.',
    });
    if (event.type !== 'paused_input') throw new Error('wrong type');
    expect(event.context).toBe('The schema has 50M rows.');
  });

  it('rejects paused_input with empty question', () => {
    expect(() =>
      AgentEventSchema.parse({
        type: 'paused_input',
        timestamp: '2026-01-01T00:00:00Z',
        question: '',
      }),
    ).toThrow();
  });

  it('rejects paused_input without timestamp', () => {
    expect(() =>
      AgentEventSchema.parse({
        type: 'paused_input',
        question: 'What should I do?',
      }),
    ).toThrow();
  });
});

describe('AgentEventSchema — resumed variant', () => {
  it('parses a valid resumed event with input_response source', () => {
    const event = AgentEventSchema.parse({
      type: 'resumed',
      timestamp: '2026-01-01T01:00:00Z',
      source: 'input_response',
    });
    expect(event.type).toBe('resumed');
    if (event.type !== 'resumed') throw new Error('wrong type');
    expect(event.source).toBe('input_response');
  });

  it('parses a valid resumed event with user_unblock source', () => {
    const event = AgentEventSchema.parse({
      type: 'resumed',
      timestamp: '2026-01-01T02:00:00Z',
      source: 'user_unblock',
    });
    if (event.type !== 'resumed') throw new Error('wrong type');
    expect(event.source).toBe('user_unblock');
  });

  it('rejects resumed with invalid source', () => {
    expect(() =>
      AgentEventSchema.parse({
        type: 'resumed',
        timestamp: '2026-01-01T00:00:00Z',
        source: 'auto',
      }),
    ).toThrow();
  });

  it('rejects resumed without source', () => {
    expect(() =>
      AgentEventSchema.parse({
        type: 'resumed',
        timestamp: '2026-01-01T00:00:00Z',
      }),
    ).toThrow();
  });
});

describe('AgentEventSchema — exhaustiveness', () => {
  it('accepts all expected event types', () => {
    const types = [
      { type: 'progress', timestamp: 't', message: 'msg' },
      { type: 'combat', timestamp: 't', message: 'msg' },
      { type: 'status_change', timestamp: 't', from: 'idle', to: 'active' },
      { type: 'log', timestamp: 't', message: 'log' },
      { type: 'completed', timestamp: 't' },
      { type: 'failed', timestamp: 't' },
      { type: 'scene_change', timestamp: 't', from: 'quest-forest', to: 'quest-cave' },
      { type: 'monster_appeared', timestamp: 't', encounterId: 'e', monsterId: 'm', monsterName: 'Goblin', monsterTypeId: 'goblin', spritePath: '/goblin.png', difficulty: 1 },
      { type: 'monster_resolved', timestamp: 't', encounterId: 'e', outcome: 'victory' },
      { type: 'paused_input', timestamp: 't', question: 'What now?' },
      { type: 'resumed', timestamp: 't', source: 'input_response' },
    ];
    for (const event of types) {
      expect(() => AgentEventSchema.parse(event)).not.toThrow();
    }
  });

  it('rejects unknown event type', () => {
    expect(() =>
      AgentEventSchema.parse({ type: 'unknown_event', timestamp: 't' }),
    ).toThrow();
  });
});
