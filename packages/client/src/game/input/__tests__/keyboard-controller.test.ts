import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyboardController } from '../keyboard-controller';
import type { ControllerEvent } from '../keyboard-controller';
import type Phaser from 'phaser';

interface MockKey {
  isDown: boolean;
}

interface MockKeys {
  left: MockKey;
  right: MockKey;
  up: MockKey;
  down: MockKey;
  space: MockKey;
  shift: MockKey;
  A: MockKey;
  D: MockKey;
  ENTER: MockKey;
  ESC: MockKey;
  TAB: MockKey;
}

function makeMockScene(): { scene: Phaser.Scene; keys: MockKeys } {
  const keys: MockKeys = {
    left: { isDown: false },
    right: { isDown: false },
    up: { isDown: false },
    down: { isDown: false },
    space: { isDown: false },
    shift: { isDown: false },
    A: { isDown: false },
    D: { isDown: false },
    ENTER: { isDown: false },
    ESC: { isDown: false },
    TAB: { isDown: false },
  };

  const scene = {
    input: {
      keyboard: {
        createCursorKeys: vi.fn(() => ({
          left: keys.left,
          right: keys.right,
          up: keys.up,
          down: keys.down,
          space: keys.space,
          shift: keys.shift,
        })),
        addKeys: vi.fn(() => ({
          W: { isDown: false },
          A: keys.A,
          D: keys.D,
          ENTER: keys.ENTER,
          ESC: keys.ESC,
          TAB: keys.TAB,
        })),
      },
    },
  } as unknown as Phaser.Scene;

  return { scene, keys };
}

function listenFor(
  controller: KeyboardController,
  event: ControllerEvent,
): { count: number } {
  const tracker = { count: 0 };
  controller.on(event, () => {
    tracker.count++;
  });
  return tracker;
}

describe('KeyboardController', () => {
  let controller: KeyboardController;
  let keys: MockKeys;

  beforeEach(() => {
    const mock = makeMockScene();
    keys = mock.keys;
    controller = new KeyboardController(mock.scene, { reducedMotion: false });
  });

  it('emits move-left when left arrow is down', () => {
    const tracker = listenFor(controller, 'move-left');
    keys.left.isDown = true;
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('emits move-left when A is down', () => {
    const tracker = listenFor(controller, 'move-left');
    keys.A.isDown = true;
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('emits move-right when right arrow is down', () => {
    const tracker = listenFor(controller, 'move-right');
    keys.right.isDown = true;
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('emits move-right when D is down', () => {
    const tracker = listenFor(controller, 'move-right');
    keys.D.isDown = true;
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('emits stop when key is released after moving', () => {
    const tracker = listenFor(controller, 'stop');
    keys.right.isDown = true;
    controller.update();
    keys.right.isDown = false;
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('does not emit stop if player was not moving', () => {
    const tracker = listenFor(controller, 'stop');
    controller.update();
    expect(tracker.count).toBe(0);
  });

  it('emits interact when Enter is just pressed', () => {
    const tracker = listenFor(controller, 'interact');
    controller.update();
    keys.ENTER.isDown = true;
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('does not repeat interact while Enter is held', () => {
    const tracker = listenFor(controller, 'interact');
    keys.ENTER.isDown = true;
    controller.update();
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('emits back when Escape is just pressed', () => {
    const tracker = listenFor(controller, 'back');
    controller.update();
    keys.ESC.isDown = true;
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('emits tab-next when Tab is just pressed', () => {
    const tracker = listenFor(controller, 'tab-next');
    controller.update();
    keys.TAB.isDown = true;
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('does not repeat tab-next while Tab is held', () => {
    const tracker = listenFor(controller, 'tab-next');
    keys.TAB.isDown = true;
    controller.update();
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('off() removes a listener', () => {
    const tracker = { count: 0 };
    const fn = () => {
      tracker.count++;
    };
    controller.on('move-left', fn);
    keys.left.isDown = true;
    controller.update();
    controller.off('move-left', fn);
    controller.update();
    expect(tracker.count).toBe(1);
  });

  it('reducedMotion reflects the provided option', () => {
    const { scene } = makeMockScene();
    const ctrl = new KeyboardController(scene, { reducedMotion: true });
    expect(ctrl.reducedMotion).toBe(true);
  });
});
