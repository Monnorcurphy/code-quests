import { describe, it, expect } from 'vitest';
import { monsterTypeIdToAssetKey, preloadMonsterAssets } from '../asset-loader';
import type Phaser from 'phaser';

const BUILTIN_MONSTER_TYPE_IDS = [
  'goblin_linter',
  'imp_typecheck',
  'wraith_flaky_test',
  'ogre_failing_test',
  'hydra_ac_mismatch',
  'mimic_silent_failure',
  'wizard_env_or_dep',
  'troll_build_fail',
  'lich_repeated_failure',
  'dragon_epic_obstacle',
] as const;

describe('monsterTypeIdToAssetKey', () => {
  it('contains all 10 built-in monster type IDs', () => {
    for (const id of BUILTIN_MONSTER_TYPE_IDS) {
      expect(
        monsterTypeIdToAssetKey,
        `expected "${id}" to be in monsterTypeIdToAssetKey`,
      ).toHaveProperty(id);
    }
  });

  it('has exactly 10 entries', () => {
    expect(Object.keys(monsterTypeIdToAssetKey)).toHaveLength(10);
  });

  it('all asset keys follow the monster-{name} pattern', () => {
    for (const [typeId, key] of Object.entries(monsterTypeIdToAssetKey)) {
      expect(key, `${typeId} → "${key}" should match monster-<name>`).toMatch(/^monster-[a-z]+$/);
    }
  });

  it('maps goblin_linter → monster-goblin', () => {
    expect(monsterTypeIdToAssetKey['goblin_linter']).toBe('monster-goblin');
  });

  it('maps imp_typecheck → monster-imp', () => {
    expect(monsterTypeIdToAssetKey['imp_typecheck']).toBe('monster-imp');
  });

  it('maps wraith_flaky_test → monster-wraith', () => {
    expect(monsterTypeIdToAssetKey['wraith_flaky_test']).toBe('monster-wraith');
  });

  it('maps ogre_failing_test → monster-ogre', () => {
    expect(monsterTypeIdToAssetKey['ogre_failing_test']).toBe('monster-ogre');
  });

  it('maps hydra_ac_mismatch → monster-hydra', () => {
    expect(monsterTypeIdToAssetKey['hydra_ac_mismatch']).toBe('monster-hydra');
  });

  it('maps mimic_silent_failure → monster-mimic', () => {
    expect(monsterTypeIdToAssetKey['mimic_silent_failure']).toBe('monster-mimic');
  });

  it('maps wizard_env_or_dep → monster-wizard', () => {
    expect(monsterTypeIdToAssetKey['wizard_env_or_dep']).toBe('monster-wizard');
  });

  it('maps troll_build_fail → monster-troll', () => {
    expect(monsterTypeIdToAssetKey['troll_build_fail']).toBe('monster-troll');
  });

  it('maps lich_repeated_failure → monster-lich', () => {
    expect(monsterTypeIdToAssetKey['lich_repeated_failure']).toBe('monster-lich');
  });

  it('maps dragon_epic_obstacle → monster-dragon', () => {
    expect(monsterTypeIdToAssetKey['dragon_epic_obstacle']).toBe('monster-dragon');
  });
});

describe('preloadMonsterAssets', () => {
  function makeMockScene() {
    const registered: Record<string, string> = {};
    const mockScene = {
      load: {
        image: (key: string, path: string) => {
          registered[key] = path;
        },
      },
    } as unknown as Phaser.Scene;
    return { mockScene, registered };
  }

  it('registers all 10 monster asset keys', () => {
    const { mockScene, registered } = makeMockScene();
    preloadMonsterAssets(mockScene);

    expect(Object.keys(registered)).toHaveLength(10);
    for (const key of Object.values(monsterTypeIdToAssetKey)) {
      expect(registered, `expected "${key}" to be registered`).toHaveProperty(key);
    }
  });

  it('all registered paths start with /assets/', () => {
    const { mockScene, registered } = makeMockScene();
    preloadMonsterAssets(mockScene);

    for (const [key, path] of Object.entries(registered)) {
      expect(path, `"${key}" path "${path}" should start with /assets/`).toMatch(/^\/assets\//);
    }
  });

  it('registers monster-goblin with /assets/monsters/goblin.png', () => {
    const { mockScene, registered } = makeMockScene();
    preloadMonsterAssets(mockScene);
    expect(registered['monster-goblin']).toBe('/assets/monsters/goblin.png');
  });

  it('registers monster-dragon with /assets/monsters/dragon.png', () => {
    const { mockScene, registered } = makeMockScene();
    preloadMonsterAssets(mockScene);
    expect(registered['monster-dragon']).toBe('/assets/monsters/dragon.png');
  });

  it('registers monster-lich with /assets/monsters/lich.png', () => {
    const { mockScene, registered } = makeMockScene();
    preloadMonsterAssets(mockScene);
    expect(registered['monster-lich']).toBe('/assets/monsters/lich.png');
  });

  it('does not register any non-monster assets', () => {
    const { mockScene, registered } = makeMockScene();
    preloadMonsterAssets(mockScene);

    for (const key of Object.keys(registered)) {
      expect(key, `"${key}" should start with "monster-"`).toMatch(/^monster-/);
    }
  });
});
