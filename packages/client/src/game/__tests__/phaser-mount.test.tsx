import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const { mockDestroy, MockGame } = vi.hoisted(() => {
  const mockDestroy = vi.fn();
  const MockGame = vi.fn().mockImplementation(() => ({ destroy: mockDestroy }));
  return { mockDestroy, MockGame };
});

vi.mock('phaser', () => ({
  default: {
    Game: MockGame,
    AUTO: 0,
    Scale: { FIT: 2, CENTER_BOTH: 5 },
    Scene: class {
      constructor(_config: unknown) {}
      create(): void {}
    },
  },
}));

import PhaserMount from '../phaser-mount';
import * as sceneRegistry from '../scene-registry';
import { registerScene } from '../scene-registry';
import type { SceneKey } from '../scene-registry';

describe('PhaserMount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  it('creates a Phaser.Game instance on mount', () => {
    render(<PhaserMount initialScene="boot" />);
    expect(MockGame).toHaveBeenCalledOnce();
  });

  it('destroys the Phaser.Game instance on unmount', () => {
    const { unmount } = render(<PhaserMount initialScene="boot" />);
    unmount();
    expect(mockDestroy).toHaveBeenCalledWith(true);
  });

  it('mounts and unmounts repeatedly without throwing', () => {
    for (let i = 0; i < 5; i++) {
      const { unmount } = render(<PhaserMount initialScene="boot" />);
      unmount();
    }
    expect(MockGame).toHaveBeenCalledTimes(5);
    expect(mockDestroy).toHaveBeenCalledTimes(5);
  });

  it('consults scene registry and includes non-boot scene in config', () => {
    class MockForestScene {}
    const forestKey = 'forest' as unknown as SceneKey;
    registerScene(forestKey, MockForestScene as new () => object);

    const getSpy = vi.spyOn(sceneRegistry, 'getScene');
    render(<PhaserMount initialScene={forestKey} />);

    expect(getSpy).toHaveBeenCalledWith(forestKey);
    const config = MockGame.mock.calls[MockGame.mock.calls.length - 1][0] as {
      scene: unknown[];
    };
    expect(config.scene).toContain(MockForestScene);
    getSpy.mockRestore();
  });
});
