import { BaseQuestScene } from './base-quest-scene';
import { registerScene } from '../scene-registry';
import { QUEST_ASSET_KEYS } from '../asset-loader';
import type { QuestSceneKey } from '../scene-registry';
import type { AssetKey } from '../asset-loader';

export class QuestCaveScene extends BaseQuestScene {
  constructor() {
    super({ key: 'quest-cave' });
  }

  get sceneKey(): QuestSceneKey {
    return 'quest-cave';
  }

  get backgroundAssetKey(): AssetKey {
    return QUEST_ASSET_KEYS.QUEST_BG_CAVE;
  }

  get groundAssetKey(): AssetKey {
    return QUEST_ASSET_KEYS.QUEST_GROUND_CAVE;
  }

  get nextSceneKey(): QuestSceneKey {
    return 'quest-dungeon';
  }
}

registerScene('quest-cave', QuestCaveScene);
