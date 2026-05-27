export type SceneKey =
  | 'boot'
  | 'test-scene'
  | 'town-square'
  | 'war-room'
  | 'oracle'
  | 'library'
  | 'tavern'
  | 'armory'
  | 'guild-hall'
  | 'hall-of-returns'
  | 'quest-forest'
  | 'quest-cave'
  | 'quest-dungeon'
  | 'quest-boss-room';

export const TOWN_SCENE_KEYS = [
  'town-square',
  'war-room',
  'oracle',
  'library',
  'tavern',
  'armory',
  'guild-hall',
  'hall-of-returns',
] as const;

export type TownSceneKey = (typeof TOWN_SCENE_KEYS)[number];

export function isTownSceneKey(key: string): key is TownSceneKey {
  return (TOWN_SCENE_KEYS as readonly string[]).includes(key);
}

export const QUEST_SCENE_KEYS = [
  'quest-forest',
  'quest-cave',
  'quest-dungeon',
  'quest-boss-room',
] as const;

export type QuestSceneKey = (typeof QUEST_SCENE_KEYS)[number];

export function isQuestSceneKey(key: string): key is QuestSceneKey {
  return (QUEST_SCENE_KEYS as readonly string[]).includes(key);
}

type SceneConstructor = new () => object;

const registry = new Map<SceneKey, SceneConstructor>();

export function registerScene(key: SceneKey, SceneClass: SceneConstructor): void {
  registry.set(key, SceneClass);
}

export function getScene(key: SceneKey): SceneConstructor | undefined {
  return registry.get(key);
}

export function getSceneList(): SceneKey[] {
  return Array.from(registry.keys());
}
