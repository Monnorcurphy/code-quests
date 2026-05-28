import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class PhaserSceneMock {
      constructor(_config: unknown) {}
    },
    AUTO: 0,
    Scale: { FIT: 0, CENTER_BOTH: 0 },
  },
}));

vi.mock('../../scene-router', () => ({
  sceneRouter: {
    requestSceneAdvance: vi.fn(),
  },
}));

vi.mock('../../asset-loader', () => ({
  preloadQuestAssets: vi.fn(),
  preloadMonsterAssets: vi.fn(),
  monsterTypeIdToAssetKey: {},
  QUEST_ASSET_KEYS: {
    QUEST_BG_FOREST: 'quest/bg-forest',
    QUEST_BG_CAVE: 'quest/bg-cave',
    QUEST_BG_DUNGEON: 'quest/bg-dungeon',
    QUEST_BG_BOSS_ROOM: 'quest/bg-boss-room',
    QUEST_GROUND_FOREST: 'quest/ground-forest',
    QUEST_GROUND_CAVE: 'quest/ground-cave',
    QUEST_GROUND_DUNGEON: 'quest/ground-dungeon',
    QUEST_GROUND_BOSS: 'quest/ground-boss',
    QUEST_PROP_FOREST_TREE: 'quest/prop-forest-tree',
    QUEST_PROP_CAVE_ROCK: 'quest/prop-cave-rock',
    QUEST_PROP_DUNGEON_PILLAR: 'quest/prop-dungeon-pillar',
    QUEST_PROP_BOSS_THRONE: 'quest/prop-boss-throne',
    QUEST_SILHOUETTE_MONSTER_SMALL: 'quest/silhouette-monster-small',
    QUEST_SILHOUETTE_MONSTER_LARGE: 'quest/silhouette-monster-large',
  },
  ASSET_KEYS: {
    CHARACTER_ADVENTURER_IDLE: 'character/adventurer-idle',
    CHARACTER_ADVENTURER_WALK: 'character/adventurer-walk',
    CHARACTER_ADVENTURER_ATTACK: 'character/adventurer-attack',
  },
}));

vi.mock('../../scene-registry', () => ({
  registerScene: vi.fn(),
}));

vi.mock('../../combat-layer', () => ({
  CombatLayer: vi.fn().mockImplementation(() => ({
    encounterActive: false,
    destroy: vi.fn(),
  })),
}));

import { sceneRouter } from '../../scene-router';
import { useQuestStore } from '../../../stores/quest-store';

function makeSprite() {
  return {
    setFlipX: vi.fn(),
    play: vi.fn(),
    x: 0,
    anims: {
      pause: vi.fn(),
      resume: vi.fn(),
    },
  };
}

function makeDimOverlay() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn(),
  };
}

function attachMockContext(scene: object) {
  const ctx = {
    cameras: {
      main: {
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        once: vi.fn(),
      },
    },
    add: {
      tileSprite: vi.fn(),
      sprite: vi.fn(() => makeSprite()),
      rectangle: vi.fn(() => makeDimOverlay()),
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
      once: vi.fn(),
      on: vi.fn(),
    },
    tweens: {
      pauseAll: vi.fn(),
      resumeAll: vi.fn(),
    },
  };
  Object.assign(scene, ctx);
  return ctx;
}

describe('QuestForestScene', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;

  beforeEach(async () => {
    vi.mocked(sceneRouter.requestSceneAdvance).mockClear();
    const { QuestForestScene } = await import('../quest-forest-scene');
    scene = new QuestForestScene();
    attachMockContext(scene);
  });

  it('has sceneKey "quest-forest"', () => {
    expect(scene.sceneKey).toBe('quest-forest');
  });

  it('has nextSceneKey "quest-cave"', () => {
    expect(scene.nextSceneKey).toBe('quest-cave');
  });

  it('create() calls preloadQuestAssets and fadeIn', async () => {
    const { preloadQuestAssets } = await import('../../asset-loader');
    scene.preload();
    expect(preloadQuestAssets).toHaveBeenCalled();
  });

  it('create() fades in (reduced motion off)', () => {
    scene.create();
    expect(scene.cameras.main.fadeIn).toHaveBeenCalledWith(300);
  });

  it('create() uses fade duration 0 when prefers-reduced-motion is set', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    scene.create();
    expect(scene.cameras.main.fadeIn).toHaveBeenCalledWith(0);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });
  });

  it('reaching right edge emits requestSceneAdvance to quest-cave', () => {
    scene.create();
    scene.player.setX(2320);
    scene.update(0, 16);
    expect(sceneRouter.requestSceneAdvance).toHaveBeenCalledWith({
      fromScene: 'quest-forest',
      toScene: 'quest-cave',
    });
  });

  it('edge trigger fires exactly once (debounce)', () => {
    scene.create();
    scene.player.setX(2320);
    scene.update(0, 16);
    scene.update(0, 16);
    scene.update(0, 16);
    expect(sceneRouter.requestSceneAdvance).toHaveBeenCalledTimes(1);
  });

  it('does not trigger advance when player is not at edge', () => {
    scene.create();
    scene.player.setX(1000);
    scene.update(0, 16);
    expect(sceneRouter.requestSceneAdvance).not.toHaveBeenCalled();
  });

  it('draws two tileSprites on create', () => {
    scene.create();
    expect(scene.add.tileSprite).toHaveBeenCalledTimes(2);
  });
});

describe('QuestCaveScene', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;

  beforeEach(async () => {
    vi.mocked(sceneRouter.requestSceneAdvance).mockClear();
    const { QuestCaveScene } = await import('../quest-cave-scene');
    scene = new QuestCaveScene();
    attachMockContext(scene);
  });

  it('has sceneKey "quest-cave"', () => {
    expect(scene.sceneKey).toBe('quest-cave');
  });

  it('has nextSceneKey "quest-dungeon"', () => {
    expect(scene.nextSceneKey).toBe('quest-dungeon');
  });

  it('reaching right edge emits requestSceneAdvance to quest-dungeon', () => {
    scene.create();
    scene.player.setX(2320);
    scene.update(0, 16);
    expect(sceneRouter.requestSceneAdvance).toHaveBeenCalledWith({
      fromScene: 'quest-cave',
      toScene: 'quest-dungeon',
    });
  });
});

describe('QuestDungeonScene', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;

  beforeEach(async () => {
    vi.mocked(sceneRouter.requestSceneAdvance).mockClear();
    const { QuestDungeonScene } = await import('../quest-dungeon-scene');
    scene = new QuestDungeonScene();
    attachMockContext(scene);
  });

  it('has sceneKey "quest-dungeon"', () => {
    expect(scene.sceneKey).toBe('quest-dungeon');
  });

  it('has nextSceneKey "quest-boss-room"', () => {
    expect(scene.nextSceneKey).toBe('quest-boss-room');
  });

  it('reaching right edge emits requestSceneAdvance to quest-boss-room', () => {
    scene.create();
    scene.player.setX(2320);
    scene.update(0, 16);
    expect(sceneRouter.requestSceneAdvance).toHaveBeenCalledWith({
      fromScene: 'quest-dungeon',
      toScene: 'quest-boss-room',
    });
  });
});

describe('QuestBossRoomScene', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;

  beforeEach(async () => {
    vi.mocked(sceneRouter.requestSceneAdvance).mockClear();
    const { QuestBossRoomScene } = await import('../quest-boss-room-scene');
    scene = new QuestBossRoomScene();
    attachMockContext(scene);
  });

  it('has sceneKey "quest-boss-room"', () => {
    expect(scene.sceneKey).toBe('quest-boss-room');
  });

  it('has nextSceneKey null (terminal scene)', () => {
    expect(scene.nextSceneKey).toBeNull();
  });

  it('does NOT emit requestSceneAdvance when player reaches right edge', () => {
    scene.create();
    scene.player.setX(2320);
    scene.update(0, 16);
    expect(sceneRouter.requestSceneAdvance).not.toHaveBeenCalled();
  });

  it('still does not advance after multiple updates at edge', () => {
    scene.create();
    scene.player.setX(2400);
    scene.update(0, 16);
    scene.update(0, 16);
    expect(sceneRouter.requestSceneAdvance).not.toHaveBeenCalled();
  });
});

describe('nextSceneKey chain', () => {
  it('forms a complete forest → cave → dungeon → boss-room → null chain', async () => {
    const { QuestForestScene } = await import('../quest-forest-scene');
    const { QuestCaveScene } = await import('../quest-cave-scene');
    const { QuestDungeonScene } = await import('../quest-dungeon-scene');
    const { QuestBossRoomScene } = await import('../quest-boss-room-scene');

    const forest = new QuestForestScene();
    const cave = new QuestCaveScene();
    const dungeon = new QuestDungeonScene();
    const boss = new QuestBossRoomScene();

    expect(forest.nextSceneKey).toBe('quest-cave');
    expect(cave.nextSceneKey).toBe('quest-dungeon');
    expect(dungeon.nextSceneKey).toBe('quest-boss-room');
    expect(boss.nextSceneKey).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Freeze behavior (paused_input / user_blocked)
// ---------------------------------------------------------------------------

describe('BaseQuestScene freeze behavior', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scene: any;
  let canvasStyle: { opacity: string };

  function attachMockContextWithGame(s: object) {
    canvasStyle = { opacity: '1' };
    const ctx = attachMockContext(s);
    Object.assign(s, {
      game: {
        registry: {
          get: vi.fn().mockReturnValue('q1'),
        },
        canvas: { style: canvasStyle },
      },
    });
    return ctx;
  }

  beforeEach(async () => {
    useQuestStore.setState({
      _nextId: 0,
      entriesByQuest: {},
      currentSceneByQuest: {},
      statusByQuest: {},
      inputRequestByQuest: {},
      userBlockerByQuest: {},
    });
    const { QuestForestScene } = await import('../quest-forest-scene');
    scene = new QuestForestScene();
    attachMockContextWithGame(scene);
  });

  afterEach(() => {
    // Clean up the store subscription registered by scene.create()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    (scene as any)._unsubscribeStore?.();
  });

  it('calls tweens.pauseAll when status changes to paused_input', () => {
    scene.create();
    useQuestStore.getState().setStatus('q1', 'paused_input');
    expect(scene.tweens.pauseAll).toHaveBeenCalled();
  });

  it('calls tweens.pauseAll when status changes to user_blocked', () => {
    scene.create();
    useQuestStore.getState().setStatus('q1', 'user_blocked');
    expect(scene.tweens.pauseAll).toHaveBeenCalled();
  });

  it('calls tweens.resumeAll when status returns to active', () => {
    scene.create();
    useQuestStore.getState().setStatus('q1', 'paused_input');
    useQuestStore.getState().setStatus('q1', 'active');
    expect(scene.tweens.resumeAll).toHaveBeenCalled();
  });

  it('shows dim overlay on freeze (non-reduced-motion path)', () => {
    scene.create();
    const overlay = scene._dimOverlay;
    expect(overlay).not.toBeNull();
    useQuestStore.getState().setStatus('q1', 'paused_input');
    expect(overlay.setVisible).toHaveBeenCalledWith(true);
  });

  it('hides dim overlay on resume (non-reduced-motion path)', () => {
    scene.create();
    const overlay = scene._dimOverlay;
    useQuestStore.getState().setStatus('q1', 'paused_input');
    useQuestStore.getState().setStatus('q1', 'active');
    expect(overlay.setVisible).toHaveBeenLastCalledWith(false);
  });

  it('does not crash if tweens has no active tweens (no-op pauseAll)', () => {
    scene.create();
    expect(() => {
      useQuestStore.getState().setStatus('q1', 'paused_input');
    }).not.toThrow();
  });

  it('applies initial freeze state immediately if quest is already paused when scene creates', () => {
    useQuestStore.getState().setStatus('q1', 'paused_input');
    scene.create();
    expect(scene.tweens.pauseAll).toHaveBeenCalled();
  });

  it('does not double-freeze if status is set to paused_input twice', () => {
    scene.create();
    useQuestStore.getState().setStatus('q1', 'paused_input');
    const callCount = scene.tweens.pauseAll.mock.calls.length;
    // Setting same status again should not trigger another pauseAll
    useQuestStore.getState().setStatus('q1', 'paused_input');
    expect(scene.tweens.pauseAll.mock.calls.length).toBe(callCount);
  });

  it('reduced-motion: sets canvas opacity to 0.7 on freeze instead of overlay', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    scene.create();
    useQuestStore.getState().setStatus('q1', 'paused_input');
    expect(canvasStyle.opacity).toBe('0.7');
    // No dim overlay created in reduced-motion mode
    expect(scene._dimOverlay).toBeNull();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });
  });

  it('reduced-motion: restores canvas opacity to 1 on resume', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    scene.create();
    useQuestStore.getState().setStatus('q1', 'paused_input');
    useQuestStore.getState().setStatus('q1', 'active');
    expect(canvasStyle.opacity).toBe('1');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: undefined,
    });
  });
});
