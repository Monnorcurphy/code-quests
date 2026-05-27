import { BaseQuestScene } from './base-quest-scene';
import { registerScene } from '../scene-registry';
import { QUEST_ASSET_KEYS } from '../asset-loader';
import type { QuestSceneKey } from '../scene-registry';
import type { AssetKey } from '../asset-loader';

export class QuestForestScene extends BaseQuestScene {
  constructor() {
    super({ key: 'quest-forest' });
  }

  get sceneKey(): QuestSceneKey {
    return 'quest-forest';
  }

  get backgroundAssetKey(): AssetKey {
    return QUEST_ASSET_KEYS.QUEST_BG_FOREST;
  }

  get groundAssetKey(): AssetKey {
    return QUEST_ASSET_KEYS.QUEST_GROUND_FOREST;
  }

  get nextSceneKey(): QuestSceneKey {
    return 'quest-cave';
  }
}

registerScene('quest-forest', QuestForestScene);
