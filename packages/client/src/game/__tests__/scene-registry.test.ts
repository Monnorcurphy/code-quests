import { describe, it, expect } from 'vitest';
import { registerScene, getScene, getSceneList } from '../scene-registry';

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
