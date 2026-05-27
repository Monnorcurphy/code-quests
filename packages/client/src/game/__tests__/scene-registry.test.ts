import { describe, it, expect } from 'vitest';
import {
  registerScene,
  getScene,
  getSceneList,
  QUEST_SCENE_KEYS,
  isQuestSceneKey,
  isTownSceneKey,
} from '../scene-registry';

class MockScene {
  create(): void {}
}

describe('scene-registry', () => {
  it('registers and retrieves a scene', () => {
    registerScene('boot', MockScene);
    expect(getScene('boot')).toBe(MockScene);
  });

  it('getSceneList includes registered key', () => {
    registerScene('boot', MockScene);
    expect(getSceneList()).toContain('boot');
  });

  it('overwrites an existing registration', () => {
    class AltScene {
      create(): void {}
    }
    registerScene('boot', MockScene);
    registerScene('boot', AltScene);
    expect(getScene('boot')).toBe(AltScene);
  });
});

describe('QUEST_SCENE_KEYS', () => {
  it('contains all four quest scene keys in order', () => {
    expect(QUEST_SCENE_KEYS).toEqual([
      'quest-forest',
      'quest-cave',
      'quest-dungeon',
      'quest-boss-room',
    ]);
  });

  it('isQuestSceneKey returns true for all quest keys', () => {
    for (const key of QUEST_SCENE_KEYS) {
      expect(isQuestSceneKey(key)).toBe(true);
    }
  });

  it('isQuestSceneKey returns false for town keys', () => {
    expect(isQuestSceneKey('town-square')).toBe(false);
    expect(isQuestSceneKey('war-room')).toBe(false);
    expect(isQuestSceneKey('boot')).toBe(false);
  });

  it('isQuestSceneKey returns false for arbitrary strings', () => {
    expect(isQuestSceneKey('unknown')).toBe(false);
    expect(isQuestSceneKey('')).toBe(false);
  });

  it('isTownSceneKey returns false for quest keys', () => {
    for (const key of QUEST_SCENE_KEYS) {
      expect(isTownSceneKey(key)).toBe(false);
    }
  });
});
