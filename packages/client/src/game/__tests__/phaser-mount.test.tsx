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
});
