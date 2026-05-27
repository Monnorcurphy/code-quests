import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SceneKey } from '../scene-registry';

// Must be set before importing scene-router since it's module-level
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockReturnValue({ matches: false }),
});

// Import after mocking window.matchMedia
const { sceneRouter } = await import('../scene-router');

function makeFadeCamera(onOnce?: (event: string, cb: () => void) => void) {
  const camera = {
    fadeOut: vi.fn(),
    fadeIn: vi.fn(),
    once: vi.fn((event: string, cb: () => void) => {
      if (onOnce) onOnce(event, cb);
    }),
  };
  return camera;
}

function makeScene(key: string, camera = makeFadeCamera()) {
  return {
    scene: {
      key,
      start: vi.fn(),
    },
    cameras: {
      main: camera,
    },
  };
}

function makeGame(activeScene: ReturnType<typeof makeScene> | null = null) {
  return {
    scene: {
      getScenes: vi.fn(() => (activeScene ? [activeScene] : [])),
      start: vi.fn(),
    },
    isBooted: true,
  };
}

describe('SceneRouter', () => {
  beforeEach(() => {
    sceneRouter.init(null);
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false });
  });

  it('is a no-op when game is not initialized', () => {
    expect(() => sceneRouter.goToScene('town-square')).not.toThrow();
  });

  it('skips transition if already on the target scene', () => {
    const scene = makeScene('town-square');
    const game = makeGame(scene as unknown as ReturnType<typeof makeScene>);
    sceneRouter.init(game as unknown as import('phaser').Game);

    sceneRouter.goToScene('town-square');

    expect(scene.cameras.main.fadeOut).not.toHaveBeenCalled();
    expect(scene.scene.start).not.toHaveBeenCalled();
  });

  it('starts scene immediately when no current scene', () => {
    const game = makeGame(null);
    sceneRouter.init(game as unknown as import('phaser').Game);

    sceneRouter.goToScene('town-square');

    expect(game.scene.start).toHaveBeenCalledWith('town-square', { spawnX: undefined });
  });

  it('fades out then starts new scene (normal motion)', () => {
    let fadeCallback: (() => void) | undefined;
    const camera = makeFadeCamera((_event, cb) => {
      fadeCallback = cb;
    });
    const scene = makeScene('boot', camera);
    const game = makeGame(scene as unknown as ReturnType<typeof makeScene>);
    sceneRouter.init(game as unknown as import('phaser').Game);

    sceneRouter.goToScene('town-square', { spawnX: 200 });

    expect(camera.fadeOut).toHaveBeenCalledWith(300, 0, 0, 0);
    expect(scene.scene.start).not.toHaveBeenCalled();

    fadeCallback?.();
    expect(scene.scene.start).toHaveBeenCalledWith('town-square', { spawnX: 200 });
  });

  it('switches scene immediately when reduced motion is enabled', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: true });
    const scene = makeScene('boot');
    const game = makeGame(scene as unknown as ReturnType<typeof makeScene>);
    sceneRouter.init(game as unknown as import('phaser').Game);

    sceneRouter.goToScene('war-room', { spawnX: 100 });

    expect(scene.cameras.main.fadeOut).not.toHaveBeenCalled();
    expect(scene.scene.start).toHaveBeenCalledWith('war-room', { spawnX: 100 });
  });

  it('passes spawnX to scene.start data', () => {
    let fadeCallback: (() => void) | undefined;
    const camera = makeFadeCamera((_event, cb) => {
      fadeCallback = cb;
    });
    const scene = makeScene('boot', camera);
    const game = makeGame(scene as unknown as ReturnType<typeof makeScene>);
    sceneRouter.init(game as unknown as import('phaser').Game);

    sceneRouter.goToScene('guild-hall', { spawnX: 450 });
    fadeCallback?.();

    expect(scene.scene.start).toHaveBeenCalledWith('guild-hall', { spawnX: 450 });
  });

  it('emits door enter event to registered handlers', () => {
    const handler = vi.fn();
    const unsubscribe = sceneRouter.onDoorEnter(handler);

    const evt = { sceneKey: 'war-room' as SceneKey, spawnX: 300 };
    sceneRouter.emitDoorEnter(evt);

    expect(handler).toHaveBeenCalledWith(evt);
    unsubscribe();
  });

  it('unsubscribes door enter handler correctly', () => {
    const handler = vi.fn();
    const unsubscribe = sceneRouter.onDoorEnter(handler);
    unsubscribe();

    sceneRouter.emitDoorEnter({ sceneKey: 'oracle' as SceneKey, spawnX: 100 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('emits to multiple handlers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const u1 = sceneRouter.onDoorEnter(h1);
    const u2 = sceneRouter.onDoorEnter(h2);

    sceneRouter.emitDoorEnter({ sceneKey: 'library' as SceneKey, spawnX: 200 });

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
    u1();
    u2();
  });

  it('notifies interactives change handlers when setInteractives is called', () => {
    const handler = vi.fn();
    const unsubscribe = sceneRouter.onInteractivesChange(handler);
    const items = [{ id: 'war-room', label: 'Enter War Room', onActivate: vi.fn() }];

    sceneRouter.setInteractives(items);

    expect(handler).toHaveBeenCalledWith(items);
    unsubscribe();
  });

  it('unsubscribes interactives change handler correctly', () => {
    const handler = vi.fn();
    const unsubscribe = sceneRouter.onInteractivesChange(handler);
    unsubscribe();

    sceneRouter.setInteractives([]);

    expect(handler).not.toHaveBeenCalled();
  });

  it('notifies multiple interactives handlers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const u1 = sceneRouter.onInteractivesChange(h1);
    const u2 = sceneRouter.onInteractivesChange(h2);
    const items = [{ id: 'oracle', label: 'Enter Oracle', onActivate: vi.fn() }];

    sceneRouter.setInteractives(items);

    expect(h1).toHaveBeenCalledWith(items);
    expect(h2).toHaveBeenCalledWith(items);
    u1();
    u2();
  });

  it('emits scene advance event to registered handler', () => {
    const handler = vi.fn();
    const unsubscribe = sceneRouter.onSceneAdvance(handler);

    const evt = { fromScene: 'quest-forest' as const, toScene: 'quest-cave' as const };
    sceneRouter.requestSceneAdvance(evt);

    expect(handler).toHaveBeenCalledWith(evt);
    unsubscribe();
  });

  it('unsubscribes scene advance handler correctly', () => {
    const handler = vi.fn();
    const unsubscribe = sceneRouter.onSceneAdvance(handler);
    unsubscribe();

    sceneRouter.requestSceneAdvance({ fromScene: 'quest-cave' as const, toScene: 'quest-dungeon' as const });

    expect(handler).not.toHaveBeenCalled();
  });

  it('emits scene advance to multiple handlers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const u1 = sceneRouter.onSceneAdvance(h1);
    const u2 = sceneRouter.onSceneAdvance(h2);

    const evt = { fromScene: 'quest-dungeon' as const, toScene: 'quest-boss-room' as const };
    sceneRouter.requestSceneAdvance(evt);

    expect(h1).toHaveBeenCalledWith(evt);
    expect(h2).toHaveBeenCalledWith(evt);
    u1();
    u2();
  });

  it('requestSceneAdvance is a no-op when no handlers are registered', () => {
    expect(() =>
      sceneRouter.requestSceneAdvance({ fromScene: 'quest-forest' as const, toScene: 'quest-cave' as const }),
    ).not.toThrow();
  });
});
