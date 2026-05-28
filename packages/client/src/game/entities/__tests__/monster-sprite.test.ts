import { describe, it, expect, vi } from 'vitest';
import { MonsterSprite } from '../monster-sprite';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    AUTO: 0,
    Scale: { FIT: 0, CENTER_BOTH: 0 },
  },
}));

interface MockImage {
  x: number;
  y: number;
  alpha: number;
  setTint: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface MockText {
  x: number;
  y: number;
  alpha: number;
  setOrigin: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface MockGraphics {
  alpha: number;
  clear: ReturnType<typeof vi.fn>;
  fillStyle: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeImage(): MockImage {
  return {
    x: 0,
    y: 0,
    alpha: 1,
    setTint: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeText(): MockText {
  const obj: MockText = {
    x: 0,
    y: 0,
    alpha: 1,
    setOrigin: vi.fn(),
    destroy: vi.fn(),
  };
  obj.setOrigin.mockReturnValue(obj);
  return obj;
}

function makeGraphics(): MockGraphics {
  const obj: MockGraphics = {
    alpha: 1,
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
    destroy: vi.fn(),
  };
  obj.clear.mockReturnValue(obj);
  obj.fillStyle.mockReturnValue(obj);
  obj.fillRect.mockReturnValue(obj);
  return obj;
}

const HP_BAR_WIDTH = 120;

function makeMockScene(options: {
  tweensAdd?: ReturnType<typeof vi.fn>;
  shake?: ReturnType<typeof vi.fn>;
  delayedCall?: ReturnType<typeof vi.fn>;
  graphicsFactory?: () => MockGraphics;
} = {}) {
  const tweensAdd = options.tweensAdd ?? vi.fn();
  const shake = options.shake ?? vi.fn();
  const delayedCall = options.delayedCall ?? vi.fn();
  const graphicsInstances: MockGraphics[] = [];

  const scene = {
    add: {
      image: vi.fn(() => makeImage()),
      text: vi.fn(() => makeText()),
      graphics: vi.fn(() => {
        const g = options.graphicsFactory ? options.graphicsFactory() : makeGraphics();
        graphicsInstances.push(g);
        return g;
      }),
    },
    tweens: { add: tweensAdd },
    cameras: { main: { shake, width: 1280 } },
    time: { delayedCall },
  };

  return { scene, tweensAdd, shake, delayedCall, graphicsInstances };
}

describe('MonsterSprite', () => {
  describe('construction', () => {
    it('creates image, two texts, and two graphics objects', () => {
      const { scene } = makeMockScene();
      new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1);
      expect(scene.add.image).toHaveBeenCalledWith(100, 200, 'test-key');
      expect(scene.add.text).toHaveBeenCalledTimes(2);
      expect(scene.add.graphics).toHaveBeenCalledTimes(2);
    });

    it('renders difficulty stars equal to the difficulty value', () => {
      const { scene } = makeMockScene();
      new MonsterSprite(scene as never, 100, 200, 'test-key', 'Dragon', 5);
      const textCalls = (scene.add.text as ReturnType<typeof vi.fn>).mock.calls;
      const starsCall = textCalls.find((c: unknown[]) => typeof c[2] === 'string' && (c[2] as string).includes('★'));
      expect(starsCall).toBeDefined();
      expect((starsCall![2] as string).split('★').length - 1).toBe(5);
    });
  });

  describe('setHp', () => {
    it('setHp(100) draws fg rect at full HP_BAR_WIDTH', () => {
      const { scene, graphicsInstances } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1);
      graphicsInstances[1].fillRect.mockClear();
      sprite.setHp(100);
      const calls = graphicsInstances[1].fillRect.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const widthArg = (calls[calls.length - 1] as number[])[2];
      expect(widthArg).toBe(HP_BAR_WIDTH);
    });

    it('setHp(50) draws fg rect at half HP_BAR_WIDTH', () => {
      const { scene, graphicsInstances } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1);
      graphicsInstances[1].fillRect.mockClear();
      sprite.setHp(50);
      const calls = graphicsInstances[1].fillRect.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const widthArg = (calls[calls.length - 1] as number[])[2];
      expect(widthArg).toBe(Math.round(HP_BAR_WIDTH * 0.5));
    });

    it('setHp(0) does not call fillRect on fg graphics', () => {
      const { scene, graphicsInstances } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1);
      graphicsInstances[1].fillRect.mockClear();
      sprite.setHp(0);
      expect(graphicsInstances[1].fillRect).not.toHaveBeenCalled();
    });

    it('clamps hp below 0 to 0 (no fg draw)', () => {
      const { scene, graphicsInstances } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1);
      graphicsInstances[1].fillRect.mockClear();
      sprite.setHp(-10);
      expect(graphicsInstances[1].fillRect).not.toHaveBeenCalled();
    });

    it('clamps hp above 100 to full bar', () => {
      const { scene, graphicsInstances } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1);
      graphicsInstances[1].fillRect.mockClear();
      sprite.setHp(150);
      const calls = graphicsInstances[1].fillRect.mock.calls;
      const widthArg = (calls[calls.length - 1] as number[])[2];
      expect(widthArg).toBe(HP_BAR_WIDTH);
    });

    it('getHp() returns the last set hp value', () => {
      const { scene } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1);
      sprite.setHp(75);
      expect(sprite.getHp()).toBe(75);
    });
  });

  describe('playVictory — reduced-motion on', () => {
    it('calls onComplete immediately without creating a tween', () => {
      const { scene, tweensAdd } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1, {
        reducedMotion: true,
      });
      const onComplete = vi.fn();
      sprite.playVictory(onComplete);
      expect(tweensAdd).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('playVictory — reduced-motion off', () => {
    it('creates a tween and does not call onComplete immediately', () => {
      const { scene, tweensAdd } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1, {
        reducedMotion: false,
      });
      const onComplete = vi.fn();
      sprite.playVictory(onComplete);
      expect(tweensAdd).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('calls onComplete when the tween onComplete fires', () => {
      const { scene, tweensAdd } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1, {
        reducedMotion: false,
      });
      const onComplete = vi.fn();
      sprite.playVictory(onComplete);
      const tweenConfig = tweensAdd.mock.calls[0][0] as { onComplete?: () => void };
      tweenConfig.onComplete?.();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('playDefeat — reduced-motion on', () => {
    it('calls onComplete immediately without shaking camera', () => {
      const { scene, shake } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1, {
        reducedMotion: true,
      });
      const onComplete = vi.fn();
      sprite.playDefeat(onComplete);
      expect(shake).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('playDefeat — reduced-motion off', () => {
    it('shakes the camera and uses delayedCall', () => {
      const { scene, shake, delayedCall } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1, {
        reducedMotion: false,
      });
      sprite.playDefeat(vi.fn());
      expect(shake).toHaveBeenCalled();
      expect(delayedCall).toHaveBeenCalled();
    });
  });

  describe('playEscape — reduced-motion on', () => {
    it('calls onComplete immediately without creating a tween', () => {
      const { scene, tweensAdd } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1, {
        reducedMotion: true,
      });
      const onComplete = vi.fn();
      sprite.playEscape(onComplete);
      expect(tweensAdd).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('playEscape — reduced-motion off', () => {
    it('creates a tween and does not call onComplete immediately', () => {
      const { scene, tweensAdd } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1, {
        reducedMotion: false,
      });
      const onComplete = vi.fn();
      sprite.playEscape(onComplete);
      expect(tweensAdd).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('destroys all game objects', () => {
      const { scene } = makeMockScene();
      const sprite = new MonsterSprite(scene as never, 100, 200, 'test-key', 'Goblin', 1);
      sprite.destroy();
      const imgArg = (scene.add.image as ReturnType<typeof vi.fn>).mock.results[0].value as MockImage;
      expect(imgArg.destroy).toHaveBeenCalled();
    });
  });
});
