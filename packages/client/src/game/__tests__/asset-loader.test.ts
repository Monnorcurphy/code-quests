import { existsSync, statSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import {
  ASSET_KEYS,
  QUEST_ASSET_KEYS,
  assetPath,
  preloadQuestAssets,
  type AssetKey,
} from '../asset-loader';
import type Phaser from 'phaser';

const __dirname = dirname(fileURLToPath(import.meta.url));
// packages/client/src/game/__tests__/ -> ../../.. -> packages/client/
const PUBLIC_ASSETS = join(__dirname, '../../../public/assets');

describe('asset-loader', () => {
  it('every registered key resolves to a file that exists in public/assets/', () => {
    for (const [name, key] of Object.entries(ASSET_KEYS)) {
      const filePath = join(PUBLIC_ASSETS, `${key}.png`);
      expect(
        existsSync(filePath),
        `ASSET_KEYS.${name} → "${key}.png" not found at ${filePath}`,
      ).toBe(true);
    }
  });

  it('every registered asset file is at least 1 KB', () => {
    for (const [name, key] of Object.entries(ASSET_KEYS)) {
      const filePath = join(PUBLIC_ASSETS, `${key}.png`);
      const { size } = statSync(filePath);
      expect(
        size,
        `ASSET_KEYS.${name} is ${size} bytes — must be ≥ 1024 bytes`,
      ).toBeGreaterThanOrEqual(1024);
    }
  });

  it('assetPath() returns a URL-path rooted at /assets/', () => {
    expect(assetPath('town/building-tavern' as AssetKey)).toBe(
      '/assets/town/building-tavern.png',
    );
    expect(assetPath('dungeon/tileset' as AssetKey)).toBe(
      '/assets/dungeon/tileset.png',
    );
  });
});

describe('asset-loader — quest assets', () => {
  it('every QUEST_ASSET_KEY resolves to a file that exists in public/assets/', () => {
    for (const [name, key] of Object.entries(QUEST_ASSET_KEYS)) {
      const filePath = join(PUBLIC_ASSETS, `${key}.png`);
      expect(
        existsSync(filePath),
        `QUEST_ASSET_KEYS.${name} → "${key}.png" not found at ${filePath}`,
      ).toBe(true);
    }
  });

  it('every quest asset file is at least 1 KB', () => {
    for (const [name, key] of Object.entries(QUEST_ASSET_KEYS)) {
      const filePath = join(PUBLIC_ASSETS, `${key}.png`);
      const { size } = statSync(filePath);
      expect(
        size,
        `QUEST_ASSET_KEYS.${name} is ${size} bytes — must be ≥ 1024 bytes`,
      ).toBeGreaterThanOrEqual(1024);
    }
  });

  it('no quest asset file exceeds 500 KB', () => {
    for (const [name, key] of Object.entries(QUEST_ASSET_KEYS)) {
      const filePath = join(PUBLIC_ASSETS, `${key}.png`);
      const { size } = statSync(filePath);
      expect(
        size,
        `QUEST_ASSET_KEYS.${name} is ${(size / 1024).toFixed(1)} KB — must be ≤ 500 KB`,
      ).toBeLessThanOrEqual(500 * 1024);
    }
  });

  it('assetPath() works for quest asset keys', () => {
    expect(assetPath('quest/bg-forest')).toBe('/assets/quest/bg-forest.png');
    expect(assetPath('quest/bg-cave')).toBe('/assets/quest/bg-cave.png');
    expect(assetPath('quest/bg-dungeon')).toBe('/assets/quest/bg-dungeon.png');
    expect(assetPath('quest/bg-boss-room')).toBe('/assets/quest/bg-boss-room.png');
    expect(assetPath('quest/silhouette-monster-small')).toBe(
      '/assets/quest/silhouette-monster-small.png',
    );
    expect(assetPath('quest/silhouette-monster-large')).toBe(
      '/assets/quest/silhouette-monster-large.png',
    );
  });

  it('preloadQuestAssets registers all QUEST_ASSET_KEYS with the scene loader', () => {
    const registeredKeys: string[] = [];
    const mockScene = {
      load: { image: (key: string, _path: string) => { registeredKeys.push(key); } },
    } as unknown as Phaser.Scene;

    preloadQuestAssets(mockScene);

    for (const key of Object.values(QUEST_ASSET_KEYS)) {
      expect(registeredKeys, `expected "${key}" to be registered by preloadQuestAssets`).toContain(key);
    }
    expect(registeredKeys).toHaveLength(Object.keys(QUEST_ASSET_KEYS).length);
  });

  it('preloadQuestAssets does NOT register town or dungeon assets', () => {
    const registeredKeys: string[] = [];
    const mockScene = {
      load: { image: (key: string, _path: string) => { registeredKeys.push(key); } },
    } as unknown as Phaser.Scene;

    preloadQuestAssets(mockScene);

    for (const key of Object.values(ASSET_KEYS)) {
      expect(
        registeredKeys,
        `preloadQuestAssets should not register common key "${key}"`,
      ).not.toContain(key);
    }
  });

  it('silhouette assets are RGBA PNG files with transparency (≥ first 4 bytes are PNG signature)', () => {
    const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const key of ['quest/silhouette-monster-small', 'quest/silhouette-monster-large'] as const) {
      const filePath = join(PUBLIC_ASSETS, `${key}.png`);
      const buf = readFileSync(filePath);
      // Verify PNG signature
      expect(buf.slice(0, 8).equals(pngSig)).toBe(true);
      // IHDR color type byte is at offset 25 (8 sig + 4 len + 4 "IHDR" + 8 width/height + 1 bitdepth = 25)
      const colorType = buf[25];
      expect(colorType, `${key} must be RGBA (color type 6), got ${colorType}`).toBe(6);
    }
  });
});
