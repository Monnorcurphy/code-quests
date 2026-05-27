import { describe, it, expect } from 'vitest';
import { EquipmentSchema } from '../equipment';

describe('EquipmentSchema', () => {
  it('parses a fully populated equipment object', () => {
    const result = EquipmentSchema.parse({
      skillIds: ['skill-1', 'skill-2'],
      toolIds: ['tool-1'],
      mcpServerIds: ['mcp-1'],
    });
    expect(result.skillIds).toEqual(['skill-1', 'skill-2']);
    expect(result.toolIds).toEqual(['tool-1']);
    expect(result.mcpServerIds).toEqual(['mcp-1']);
  });

  it('defaults all arrays to empty when omitted', () => {
    const result = EquipmentSchema.parse({});
    expect(result.skillIds).toEqual([]);
    expect(result.toolIds).toEqual([]);
    expect(result.mcpServerIds).toEqual([]);
  });

  it('defaults skillIds to empty array when omitted', () => {
    const result = EquipmentSchema.parse({ toolIds: ['t-1'], mcpServerIds: [] });
    expect(result.skillIds).toEqual([]);
  });

  it('defaults toolIds to empty array when omitted', () => {
    const result = EquipmentSchema.parse({ skillIds: ['s-1'], mcpServerIds: [] });
    expect(result.toolIds).toEqual([]);
  });

  it('defaults mcpServerIds to empty array when omitted', () => {
    const result = EquipmentSchema.parse({ skillIds: [], toolIds: ['t-1'] });
    expect(result.mcpServerIds).toEqual([]);
  });

  it('rejects non-array skillIds', () => {
    expect(() => EquipmentSchema.parse({ skillIds: 'not-an-array' })).toThrow();
  });

  it('rejects non-array toolIds', () => {
    expect(() => EquipmentSchema.parse({ toolIds: 42 })).toThrow();
  });

  it('rejects non-string entries in arrays', () => {
    expect(() => EquipmentSchema.parse({ skillIds: [123] })).toThrow();
  });

  it('parses an empty equipment object (no loadout)', () => {
    const result = EquipmentSchema.parse({});
    expect(result).toEqual({ skillIds: [], toolIds: [], mcpServerIds: [] });
  });
});
