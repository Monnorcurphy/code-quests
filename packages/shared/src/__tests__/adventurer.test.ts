import { describe, it, expect } from 'vitest';
import { AdventurerSchema, AdventurerClassSchema } from '../adventurer';

describe('AdventurerClassSchema', () => {
  it('accepts all valid classes', () => {
    const classes = ['champion', 'ranger', 'scout', 'rogue', 'apprentice'];
    for (const cls of classes) {
      expect(AdventurerClassSchema.parse(cls)).toBe(cls);
    }
  });

  it('rejects an invalid class', () => {
    expect(() => AdventurerClassSchema.parse('wizard')).toThrow();
    expect(() => AdventurerClassSchema.parse('paladin')).toThrow();
    expect(() => AdventurerClassSchema.parse('')).toThrow();
    expect(() => AdventurerClassSchema.parse(null)).toThrow();
  });
});

describe('AdventurerSchema', () => {
  const valid = {
    id: 'adv-1',
    name: 'Aria',
    class: 'ranger' as const,
    modelId: 'claude-sonnet-4-6',
    createdAt: '2026-01-01T00:00:00Z',
    stats: {},
    specializations: [],
    scars: [],
  };

  it('parses a valid adventurer', () => {
    const result = AdventurerSchema.parse(valid);
    expect(result.id).toBe('adv-1');
    expect(result.name).toBe('Aria');
    expect(result.class).toBe('ranger');
  });

  it('accepts all adventurer classes', () => {
    const classes = ['champion', 'ranger', 'scout', 'rogue', 'apprentice'] as const;
    for (const cls of classes) {
      const result = AdventurerSchema.parse({ ...valid, class: cls });
      expect(result.class).toBe(cls);
    }
  });

  it('defaults stats to empty object when omitted', () => {
    const { stats: _stats, ...withoutStats } = valid;
    const result = AdventurerSchema.parse(withoutStats);
    expect(result.stats).toEqual({});
  });

  it('defaults specializations to empty array when omitted', () => {
    const { specializations: _spec, ...withoutSpec } = valid;
    const result = AdventurerSchema.parse(withoutSpec);
    expect(result.specializations).toEqual([]);
  });

  it('defaults scars to empty array when omitted', () => {
    const { scars: _scars, ...withoutScars } = valid;
    const result = AdventurerSchema.parse(withoutScars);
    expect(result.scars).toEqual([]);
  });

  it('rejects missing id', () => {
    const { id: _id, ...withoutId } = valid;
    expect(() => AdventurerSchema.parse(withoutId)).toThrow();
  });

  it('rejects missing name', () => {
    const { name: _name, ...withoutName } = valid;
    expect(() => AdventurerSchema.parse(withoutName)).toThrow();
  });

  it('rejects invalid class', () => {
    expect(() => AdventurerSchema.parse({ ...valid, class: 'wizard' })).toThrow();
  });

  it('rejects missing modelId', () => {
    const { modelId: _modelId, ...withoutModelId } = valid;
    expect(() => AdventurerSchema.parse(withoutModelId)).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => AdventurerSchema.parse({ ...valid, name: '' })).toThrow();
  });
});
