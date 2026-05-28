import { BaseQuestScene } from './base-quest-scene';
import { registerScene } from '../scene-registry';
import { QUEST_ASSET_KEYS } from '../asset-loader';
import type { QuestSceneKey } from '../scene-registry';
import type { AssetKey } from '../asset-loader';

export class QuestDungeonScene extends BaseQuestScene {
  constructor() {
    super({ key: 'quest-dungeon' });
  }

  get sceneKey(): QuestSceneKey {
    return 'quest-dungeon';
  }

  get backgroundAssetKey(): AssetKey {
    return QUEST_ASSET_KEYS.QUEST_BG_DUNGEON;
  }

  get groundAssetKey(): AssetKey {
    return QUEST_ASSET_KEYS.QUEST_GROUND_DUNGEON;
  }

  get nextSceneKey(): QuestSceneKey {
    return 'quest-boss-room';
  }
}

registerScene('quest-dungeon', QuestDungeonScene);
