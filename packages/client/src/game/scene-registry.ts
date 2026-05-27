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
  | 'hall-of-returns';

export const TOWN_SCENE_KEYS: readonly SceneKey[] = [
  'town-square',
  'war-room',
  'oracle',
  'library',
  'tavern',
  'armory',
  'guild-hall',
  'hall-of-returns',
] as const;

export function isTownSceneKey(key: string): key is SceneKey {
  return (TOWN_SCENE_KEYS as readonly string[]).includes(key);
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
