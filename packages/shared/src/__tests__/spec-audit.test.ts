import { describe, it, expect } from 'vitest';
import {
  SpecGapBuildingSchema,
  SpecGapSeveritySchema,
  SpecGapSchema,
  SpecAuditSchema,
} from '../spec-audit';

describe('SpecGapBuildingSchema', () => {
  const valid = ['war_room', 'oracle', 'library', 'tavern', 'armory', 'guild_hall'];

  it('accepts all valid building values', () => {
    for (const b of valid) {
      expect(SpecGapBuildingSchema.parse(b)).toBe(b);
    }
  });

  it('rejects unknown building values', () => {
    expect(() => SpecGapBuildingSchema.parse('hall_of_returns')).toThrow();
    expect(() => SpecGapBuildingSchema.parse('town_square')).toThrow();
    expect(() => SpecGapBuildingSchema.parse('')).toThrow();
    expect(() => SpecGapBuildingSchema.parse(null)).toThrow();
  });
});

describe('SpecGapSeveritySchema', () => {
  it('accepts warn and block', () => {
    expect(SpecGapSeveritySchema.parse('warn')).toBe('warn');
    expect(SpecGapSeveritySchema.parse('block')).toBe('block');
  });

  it('rejects unknown severity values', () => {
    expect(() => SpecGapSeveritySchema.parse('error')).toThrow();
    expect(() => SpecGapSeveritySchema.parse('info')).toThrow();
    expect(() => SpecGapSeveritySchema.parse('')).toThrow();
    expect(() => SpecGapSeveritySchema.parse(null)).toThrow();
  });
});

describe('SpecGapSchema', () => {
  const valid = {
    building: 'oracle' as const,
    reason: 'Acceptance criteria are missing',
    severity: 'block' as const,
  };

  it('parses a valid gap', () => {
    const result = SpecGapSchema.parse(valid);
    expect(result.building).toBe('oracle');
    expect(result.severity).toBe('block');
    expect(result.reason).toBe('Acceptance criteria are missing');
  });

  it('rejects unknown building', () => {
    expect(() => SpecGapSchema.parse({ ...valid, building: 'dungeon' })).toThrow();
  });

  it('rejects unknown severity', () => {
    expect(() => SpecGapSchema.parse({ ...valid, severity: 'fatal' })).toThrow();
  });

  it('rejects empty reason', () => {
    expect(() => SpecGapSchema.parse({ ...valid, reason: '' })).toThrow();
  });

  it('rejects reason exceeding 500 chars', () => {
    expect(() => SpecGapSchema.parse({ ...valid, reason: 'x'.repeat(501) })).toThrow();
  });

  it('accepts reason at exactly 500 chars', () => {
    const result = SpecGapSchema.parse({ ...valid, reason: 'x'.repeat(500) });
    expect(result.reason).toHaveLength(500);
  });

  it('rejects missing building', () => {
    const { building: _b, ...withoutBuilding } = valid;
    expect(() => SpecGapSchema.parse(withoutBuilding)).toThrow();
  });
});

describe('SpecAuditSchema', () => {
  const validGap = {
    building: 'tavern' as const,
    reason: 'No edge cases recorded',
    severity: 'warn' as const,
  };

  const valid = {
    runAt: '2026-05-27T10:00:00.000Z',
    gaps: [validGap],
    bypassed: false,
  };

  it('parses a valid audit', () => {
    const result = SpecAuditSchema.parse(valid);
    expect(result.runAt).toBe(valid.runAt);
    expect(result.gaps).toHaveLength(1);
    expect(result.bypassed).toBe(false);
  });

  it('defaults bypassed to false when omitted', () => {
    const { bypassed: _b, ...withoutBypassed } = valid;
    const result = SpecAuditSchema.parse(withoutBypassed);
    expect(result.bypassed).toBe(false);
  });

  it('accepts empty gaps array', () => {
    const result = SpecAuditSchema.parse({ ...valid, gaps: [] });
    expect(result.gaps).toEqual([]);
  });

  it('rejects missing runAt', () => {
    const { runAt: _r, ...withoutRunAt } = valid;
    expect(() => SpecAuditSchema.parse(withoutRunAt)).toThrow();
  });

  it('rejects empty runAt string', () => {
    expect(() => SpecAuditSchema.parse({ ...valid, runAt: '' })).toThrow();
  });

  it('rejects invalid gap in the gaps array', () => {
    expect(() =>
      SpecAuditSchema.parse({ ...valid, gaps: [{ building: 'dungeon', reason: 'x', severity: 'warn' }] }),
    ).toThrow();
  });

  it('parses bypassed=true', () => {
    const result = SpecAuditSchema.parse({ ...valid, bypassed: true });
    expect(result.bypassed).toBe(true);
  });
});
