export type SceneKey = 'boot';

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
