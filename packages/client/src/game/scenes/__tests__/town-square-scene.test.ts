import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class PhaserSceneMock {
      constructor(_config: unknown) {}
    },
    AUTO: 0,
    Scale: { FIT: 0, CENTER_BOTH: 0 },
  },
}));

vi.mock('../../../stores/town-store', () => ({
  useTownStore: {
    getState: vi.fn(),
  },
}));

vi.mock('../../scene-router', () => ({
  sceneRouter: {
    setInteractives: vi.fn(),
    emitDoorEnter: vi.fn(),
  },
}));

vi.mock('../../asset-loader', () => ({
  preloadCommonAssets: vi.fn(),
  ASSET_KEYS: {
    CHARACTER_ADVENTURER_IDLE: 'character/adventurer-idle',
    CHARACTER_ADVENTURER_WALK: 'character/adventurer-walk',
  },
}));

vi.mock('../scene-registry', () => ({
  registerScene: vi.fn(),
}));

import { useTownStore } from '../../../stores/town-store';
import { sceneRouter } from '../../scene-router';

type MockStoreFn = ReturnType<typeof vi.fn>;

function makeText() {
  return { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() };
}

function makeRect() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  };
}

function makeSprite() {
  return { setFlipX: vi.fn(), play: vi.fn(), x: 0 };
}

function buildMockStore(extra: Partial<Record<string, unknown>> = {}) {
  return {
    setActiveModal: vi.fn(),
    setPlayerX: vi.fn(),
    setFacing: vi.fn(),
    activeModal: null,
    ...extra,
  };
}

function attachMockContext(scene: object) {
  const shutdownHandlers: Array<() => void> = [];

  const ctx = {
    cameras: {
      main: {
        setBackgroundColor: vi.fn(),
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        once: vi.fn(),
        setBounds: vi.fn(),
        startFollow: vi.fn(),
        height: 720,
      },
    },
    add: {
      rectangle: vi.fn(() => makeRect()),
      sprite: vi.fn(() => makeSprite()),
      text: vi.fn(() => makeText()),
      ellipse: vi.fn(() => makeRect()),
      image: vi.fn(() => makeRect()),
    },
    textures: { exists: vi.fn(() => false) },
    anims: {
      exists: vi.fn(() => false),
      create: vi.fn(),
    },
    input: {
      keyboard: {
        createCursorKeys: vi.fn(() => ({
          left: { isDown: false },
          right: { isDown: false },
        })),
        addKeys: vi.fn(() => ({
          A: { isDown: false },
          D: { isDown: false },
          ENTER: { isDown: false },
          ESC: { isDown: false },
          TAB: { isDown: false },
        })),
      },
    },
    events: {
      once: vi.fn((event: string, cb: () => void) => {
        if (event === 'shutdown') shutdownHandlers.push(cb);
      }),
      on: vi.fn(),
    },
    __triggerShutdown: () => shutdownHandlers.forEach((h) => h()),
  };

  Object.assign(scene, ctx);
  return ctx;
}

describe('TownSquareScene', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let SceneClass: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;
  let mockStore: ReturnType<typeof buildMockStore>;

  beforeEach(async () => {
    vi.mocked(sceneRouter.setInteractives).mockClear();
    vi.mocked(sceneRouter.emitDoorEnter).mockClear();

    mockStore = buildMockStore();
    vi.mocked(useTownStore.getState as MockStoreFn).mockReturnValue(mockStore);

    const mod = await import('../town-square-scene');
    SceneClass = mod.TownSquareScene;
    scene = new SceneClass();
    attachMockContext(scene);
  });

  it('has sceneKey "town-square"', () => {
    expect(scene.sceneKey).toBe('town-square');
  });

  it('has defaultSpawnX at center (1600)', () => {
    expect(scene.defaultSpawnX).toBe(1600);
  });

  it('has sceneWidth 3200', () => {
    expect(scene.sceneWidth).toBe(3200);
  });

  it('has exactly 7 door configs', () => {
    expect(scene.doorConfigs).toHaveLength(7);
  });

  it('door configs target all 7 buildings', () => {
    const targets = scene.doorConfigs.map((d: { targetScene: string }) => d.targetScene);
    expect(targets).toContain('war-room');
    expect(targets).toContain('oracle');
    expect(targets).toContain('library');
    expect(targets).toContain('tavern');
    expect(targets).toContain('armory');
    expect(targets).toContain('guild-hall');
    expect(targets).toContain('hall-of-returns');
  });

  it('door labels follow "Door: <Name>" format', () => {
    for (const cfg of scene.doorConfigs) {
      expect(cfg.label).toMatch(/^Door: /);
    }
  });

  it('registers quest-board, recruit-banner plus 7 doors as interactives', () => {
    scene.create();

    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];

    const ids = lastCall.map((item: { id: string }) => item.id);
    expect(ids).toContain('quest-board');
    expect(ids).toContain('recruit-banner');
    expect(ids).toHaveLength(9); // quest-board + recruit-banner + 7 doors
  });

  it('quest-board interactive has label "Quest Board"', () => {
    scene.create();

    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];

    const qb = lastCall.find((item: { id: string }) => item.id === 'quest-board');
    expect(qb?.label).toBe('Quest Board');
  });

  it('recruit-banner interactive has label "Recruit Banner"', () => {
    scene.create();

    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];

    const rb = lastCall.find((item: { id: string }) => item.id === 'recruit-banner');
    expect(rb?.label).toBe('Recruit Banner');
  });

  it('activating quest-board interactive sets activeModal to "quest-board"', () => {
    scene.create();

    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];

    const qb = lastCall.find((item: { id: string }) => item.id === 'quest-board');
    qb?.onActivate();

    expect(mockStore.setActiveModal).toHaveBeenCalledWith('quest-board');
  });

  it('activating recruit-banner interactive sets activeModal to "recruit"', () => {
    scene.create();

    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];

    const rb = lastCall.find((item: { id: string }) => item.id === 'recruit-banner');
    rb?.onActivate();

    expect(mockStore.setActiveModal).toHaveBeenCalledWith('recruit');
  });

  it('shutdown clears activeModal', () => {
    scene.create();
    scene.__triggerShutdown();

    expect(mockStore.setActiveModal).toHaveBeenCalledWith(null);
  });

  it('update skips game logic when activeModal is set', () => {
    scene.create();

    const pausedStore = buildMockStore({ activeModal: 'quest-board' });
    vi.mocked(useTownStore.getState as MockStoreFn).mockReturnValue(pausedStore);

    scene.update(0, 16);

    expect(pausedStore.setPlayerX).not.toHaveBeenCalled();
    expect(pausedStore.setFacing).not.toHaveBeenCalled();
  });
});
