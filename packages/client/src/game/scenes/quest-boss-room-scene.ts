import { BaseQuestScene } from './base-quest-scene';
import { registerScene } from '../scene-registry';
import { QUEST_ASSET_KEYS } from '../asset-loader';
import type { QuestSceneKey } from '../scene-registry';
import type { AssetKey } from '../asset-loader';

export class QuestBossRoomScene extends BaseQuestScene {
  constructor() {
    super({ key: 'quest-boss-room' });
  }

  get sceneKey(): QuestSceneKey {
    return 'quest-boss-room';
  }

  get backgroundAssetKey(): AssetKey {
    return QUEST_ASSET_KEYS.QUEST_BG_BOSS_ROOM;
  }

  get groundAssetKey(): AssetKey {
    return QUEST_ASSET_KEYS.QUEST_GROUND_BOSS;
  }

  get nextSceneKey(): QuestSceneKey | null {
    return null;
  }
}

registerScene('quest-boss-room', QuestBossRoomScene);
