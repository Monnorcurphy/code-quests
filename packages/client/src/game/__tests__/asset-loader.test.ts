import { existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { ASSET_KEYS, assetPath, type AssetKey } from '../asset-loader';

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
