import { describe, it, expect } from 'vitest';
import { paletteForStyle, adventurerTextureKeys } from '../procedural-sprites';

describe('paletteForStyle', () => {
  it('returns the default forest-green palette when style is undefined', () => {
    const palette = paletteForStyle(undefined);
    expect(palette.tunic).toBe(0x3d6e3a);
    expect(palette.tunicDark).toBe(0x254a23);
    expect(palette.hair).toBe(0x7a4a18);
    // Untouched defaults still present
    expect(palette.skin).toBe(0xf4d0a4);
    expect(palette.outline).toBe(0x1a0e08);
  });

  it('returns the default palette for an empty style object', () => {
    const palette = paletteForStyle({});
    expect(palette.tunic).toBe(0x3d6e3a);
    expect(palette.hair).toBe(0x7a4a18);
  });

  it('applies a chosen tunic color and matching dark shade', () => {
    const palette = paletteForStyle({ tunic: 'red' });
    expect(palette.tunic).toBe(0x9a2828);
    expect(palette.tunicDark).toBe(0x5c1414);
    // Hair stays at the default since it was not overridden
    expect(palette.hair).toBe(0x7a4a18);
  });

  it('applies a chosen hair color independently of tunic', () => {
    const palette = paletteForStyle({ hair: 'silver' });
    expect(palette.hair).toBe(0xc8c8d0);
    expect(palette.tunic).toBe(0x3d6e3a); // unchanged
  });

  it('applies both tunic and hair when both are set', () => {
    const palette = paletteForStyle({ tunic: 'gold', hair: 'black' });
    expect(palette.tunic).toBe(0xd4a83a);
    expect(palette.tunicDark).toBe(0x8a6a18);
    expect(palette.hair).toBe(0x1a1208);
  });

  it('covers every TunicColor enum value without throwing', () => {
    const tunics = ['green', 'blue', 'red', 'gold', 'purple', 'brown'] as const;
    for (const t of tunics) {
      const p = paletteForStyle({ tunic: t });
      expect(typeof p.tunic).toBe('number');
      expect(typeof p.tunicDark).toBe('number');
      // base and dark should differ for legibility
      expect(p.tunic).not.toBe(p.tunicDark);
    }
  });

  it('covers every HairColor enum value without throwing', () => {
    const hairs = ['brown', 'blonde', 'black', 'red', 'silver'] as const;
    for (const h of hairs) {
      const p = paletteForStyle({ hair: h });
      expect(typeof p.hair).toBe('number');
    }
  });
});

describe('adventurerTextureKeys', () => {
  it('returns id-scoped keys for idle, walk, attack', () => {
    expect(adventurerTextureKeys('abc-123')).toEqual({
      idle: 'adv-abc-123-idle',
      walk: 'adv-abc-123-walk',
      attack: 'adv-abc-123-attack',
    });
  });
});
