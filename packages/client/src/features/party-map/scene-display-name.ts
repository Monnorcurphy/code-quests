import type { QuestSceneKey } from '@code-quests/shared';

export const SCENE_DISPLAY_NAMES: Record<QuestSceneKey, string> = {
  'quest-forest': 'Forest path',
  'quest-cave': 'Cave',
  'quest-dungeon': 'Dungeon corridor',
  'quest-boss-room': 'Boss chamber',
};

export function sceneDisplayName(key: QuestSceneKey): string {
  return SCENE_DISPLAY_NAMES[key];
}
