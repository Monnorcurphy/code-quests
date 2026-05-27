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
      },
    },
    add: {
      rectangle: vi.fn(() => makeRect()),
      sprite: vi.fn(() => makeSprite()),
      text: vi.fn(() => makeText()),
    },
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

function buildScene(scene: object, mockStore: ReturnType<typeof buildMockStore>) {
  vi.mocked(useTownStore.getState as MockStoreFn).mockReturnValue(mockStore);
  attachMockContext(scene);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scene as any).create();
}

describe('WarRoomScene', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;
  let mockStore: ReturnType<typeof buildMockStore>;

  beforeEach(async () => {
    vi.mocked(sceneRouter.setInteractives).mockClear();
    vi.mocked(sceneRouter.emitDoorEnter).mockClear();
    mockStore = buildMockStore();
    const { WarRoomScene } = await import('../war-room-scene');
    scene = new WarRoomScene();
    buildScene(scene, mockStore);
  });

  it('has sceneKey "war-room"', () => {
    expect(scene.sceneKey).toBe('war-room');
  });

  it('has a single return door to town-square', () => {
    const configs = scene.doorConfigs;
    expect(configs).toHaveLength(1);
    expect(configs[0].targetScene).toBe('town-square');
  });

  it('return door label is "Return to Town Square"', () => {
    expect(scene.doorConfigs[0].label).toBe('Return to Town Square');
  });

  it('registers planning-table and return door interactives', () => {
    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const ids = lastCall.map((i: { id: string }) => i.id);
    expect(ids).toContain('planning-table');
    expect(ids).toContain('town-square');
  });

  it('activating planning-table sets activeModal to "draft"', () => {
    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const tableItem = lastCall.find((i: { id: string }) => i.id === 'planning-table');
    tableItem?.onActivate();
    expect(mockStore.setActiveModal).toHaveBeenCalledWith('draft');
  });

  it('activating return door emits door enter to town-square', () => {
    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const doorItem = lastCall.find((i: { id: string }) => i.id === 'town-square');
    doorItem?.onActivate();
    expect(sceneRouter.emitDoorEnter).toHaveBeenCalledWith(
      expect.objectContaining({ sceneKey: 'town-square' }),
    );
  });

  it('shutdown clears activeModal', () => {
    scene.__triggerShutdown();
    expect(mockStore.setActiveModal).toHaveBeenCalledWith(null);
  });
});

describe('GuildHallScene', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;
  let mockStore: ReturnType<typeof buildMockStore>;

  beforeEach(async () => {
    vi.mocked(sceneRouter.setInteractives).mockClear();
    vi.mocked(sceneRouter.emitDoorEnter).mockClear();
    mockStore = buildMockStore();
    const { GuildHallScene } = await import('../guild-hall-scene');
    scene = new GuildHallScene();
    buildScene(scene, mockStore);
  });

  it('has sceneKey "guild-hall"', () => {
    expect(scene.sceneKey).toBe('guild-hall');
  });

  it('has a single return door to town-square', () => {
    expect(scene.doorConfigs[0].targetScene).toBe('town-square');
  });

  it('registers guild-roster and return door interactives', () => {
    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const ids = lastCall.map((i: { id: string }) => i.id);
    expect(ids).toContain('guild-roster');
    expect(ids).toContain('town-square');
  });

  it('activating guild-roster sets activeModal to "guild-hall"', () => {
    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const rosterItem = lastCall.find((i: { id: string }) => i.id === 'guild-roster');
    rosterItem?.onActivate();
    expect(mockStore.setActiveModal).toHaveBeenCalledWith('guild-hall');
  });

  it('shutdown clears activeModal', () => {
    scene.__triggerShutdown();
    expect(mockStore.setActiveModal).toHaveBeenCalledWith(null);
  });
});

describe('ArmoryScene', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;
  let mockStore: ReturnType<typeof buildMockStore>;

  beforeEach(async () => {
    vi.mocked(sceneRouter.setInteractives).mockClear();
    vi.mocked(sceneRouter.emitDoorEnter).mockClear();
    mockStore = buildMockStore();
    const { ArmoryScene } = await import('../armory-scene');
    scene = new ArmoryScene();
    buildScene(scene, mockStore);
  });

  it('has sceneKey "armory"', () => {
    expect(scene.sceneKey).toBe('armory');
  });

  it('has a single return door to town-square', () => {
    expect(scene.doorConfigs[0].targetScene).toBe('town-square');
  });

  it('registers both return door and armory-loadout interactives', () => {
    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const ids = lastCall.map((i: { id: string }) => i.id);
    expect(ids).toContain('town-square');
    expect(ids).toContain('armory-loadout');
  });

  it('activating armory-loadout sets activeModal to "armory-loadout"', () => {
    const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const item = lastCall.find((i: { id: string }) => i.id === 'armory-loadout');
    item?.onActivate();
    expect(mockStore.setActiveModal).toHaveBeenCalledWith('armory-loadout');
  });

  it('does not auto-open coming-soon on create', () => {
    expect(mockStore.setActiveModal).not.toHaveBeenCalledWith('coming-soon');
  });

  it('shutdown clears activeModal', () => {
    scene.__triggerShutdown();
    expect(mockStore.setActiveModal).toHaveBeenCalledWith(null);
  });
});

const PLACEHOLDER_SCENES = [
  { name: 'OracleScene', key: 'oracle', module: '../oracle-scene' },
  { name: 'LibraryScene', key: 'library', module: '../library-scene' },
  { name: 'TavernScene', key: 'tavern', module: '../tavern-scene' },
  { name: 'HallOfReturnsScene', key: 'hall-of-returns', module: '../hall-of-returns-scene' },
] as const;

for (const { name, key, module: modulePath } of PLACEHOLDER_SCENES) {
  describe(name, () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scene: any;
    let mockStore: ReturnType<typeof buildMockStore>;

    beforeEach(async () => {
      vi.mocked(sceneRouter.setInteractives).mockClear();
      vi.mocked(sceneRouter.emitDoorEnter).mockClear();
      mockStore = buildMockStore();
      const mod = await import(modulePath);
      const SceneClass = mod[name];
      scene = new SceneClass();
      buildScene(scene, mockStore);
    });

    it(`has sceneKey "${key}"`, () => {
      expect(scene.sceneKey).toBe(key);
    });

    it('has a single return door to town-square', () => {
      const configs = scene.doorConfigs;
      expect(configs).toHaveLength(1);
      expect(configs[0].targetScene).toBe('town-square');
    });

    it('return door label is "Return to Town Square"', () => {
      expect(scene.doorConfigs[0].label).toBe('Return to Town Square');
    });

    it('registers return door interactive', () => {
      const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      const ids = lastCall.map((i: { id: string }) => i.id);
      expect(ids).toContain('town-square');
    });

    it('activating return door emits door enter to town-square', () => {
      const calls = vi.mocked(sceneRouter.setInteractives).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      const doorItem = lastCall.find((i: { id: string }) => i.id === 'town-square');
      doorItem?.onActivate();
      expect(sceneRouter.emitDoorEnter).toHaveBeenCalledWith(
        expect.objectContaining({ sceneKey: 'town-square' }),
      );
    });

    it('sets activeModal to "coming-soon" on create', () => {
      expect(mockStore.setActiveModal).toHaveBeenCalledWith('coming-soon');
    });

    it('shutdown clears activeModal', () => {
      scene.__triggerShutdown();
      expect(mockStore.setActiveModal).toHaveBeenCalledWith(null);
    });
  });
}
