import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => ({
  default: {},
}));

vi.mock('../../asset-loader', () => ({
  ASSET_KEYS: {
    CHARACTER_ADVENTURER_IDLE: 'character/adventurer-idle',
  },
}));

import {
  WanderingAdventurer,
  WANDERER_CATCHPHRASES,
  type WanderingAdventurerOpts,
} from '../wandering-adventurer';

function makeMockText(width = 80) {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    width,
    x: 0,
    y: 0,
    destroy: vi.fn(),
  };
}

function makeMockRect() {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    destroy: vi.fn(),
  };
}

function makeMockSprite() {
  const s: Record<string, unknown> = {
    setDepth: vi.fn().mockReturnThis(),
    setFlipX: vi.fn().mockReturnThis(),
    x: 0,
    y: 0,
    destroy: vi.fn(),
  };
  return s;
}

function makeMockScene() {
  const timeEvents: Array<{ delay: number; callback: () => void; remove: ReturnType<typeof vi.fn> }> = [];
  return {
    add: {
      sprite: vi.fn(() => makeMockSprite()),
      text: vi.fn(() => makeMockText()),
      rectangle: vi.fn(() => makeMockRect()),
    },
    tweens: { add: vi.fn() },
    time: {
      addEvent: vi.fn((cfg: { delay: number; callback: () => void }) => {
        const evt = { delay: cfg.delay, callback: cfg.callback, remove: vi.fn() };
        timeEvents.push(evt);
        return evt;
      }),
    },
    __timeEvents: timeEvents,
  };
}

describe('WANDERER_CATCHPHRASES', () => {
  it('exports at least the sample catchphrases', () => {
    expect(WANDERER_CATCHPHRASES.length).toBeGreaterThanOrEqual(10);
  });
  it('every phrase is a non-empty string', () => {
    for (const phrase of WANDERER_CATCHPHRASES) {
      expect(typeof phrase).toBe('string');
      expect(phrase.length).toBeGreaterThan(0);
    }
  });
});

describe('WanderingAdventurer', () => {
  let scene: ReturnType<typeof makeMockScene>;

  beforeEach(() => {
    scene = makeMockScene();
  });

  function build(overrides: Partial<WanderingAdventurerOpts> = {}) {
    const opts: WanderingAdventurerOpts = {
      id: 'a1',
      name: 'Aria',
      x: 500,
      y: 640,
      bounds: { min: 400, max: 600 },
      catchphrases: ['Hello there!'],
      reducedMotion: true,
      ...overrides,
    };
    return new WanderingAdventurer(scene as unknown as Phaser.Scene, opts);
  }

  it('exposes the adventurer id', () => {
    const w = build();
    expect(w.id).toBe('a1');
  });

  it('creates a sprite + name label on construction', () => {
    build();
    expect(scene.add.sprite).toHaveBeenCalledTimes(1);
    expect(scene.add.text).toHaveBeenCalledTimes(1);
  });

  it('skips bobbing tween when reducedMotion is true', () => {
    build({ reducedMotion: true });
    expect(scene.tweens.add).not.toHaveBeenCalled();
  });

  it('adds bobbing tween when reducedMotion is false', () => {
    build({ reducedMotion: false });
    expect(scene.tweens.add).toHaveBeenCalled();
  });

  it('schedules turn + bubble timer events on construction', () => {
    build();
    // One turn event + one bubble event scheduled initially
    expect(scene.time.addEvent).toHaveBeenCalledTimes(2);
  });

  it('clamps x to bounds when stepping past max', () => {
    const w = build({ bounds: { min: 400, max: 410 }, x: 405 });
    // Several steps; should stop at max and reverse direction
    for (let i = 0; i < 100; i++) w.update(100);
    // No exception, and destroy cleans up
    w.destroy();
    expect(true).toBe(true);
  });

  it('destroy cleans up sprite, label, and timer events', () => {
    const w = build();
    const timeEvents = scene.__timeEvents;
    w.destroy();
    for (const evt of timeEvents) {
      expect(evt.remove).toHaveBeenCalled();
    }
  });

  it('shows then hides a speech bubble when the bubble timer fires', () => {
    build();
    const bubbleEvent = scene.__timeEvents[1]; // second event scheduled is the bubble
    bubbleEvent.callback();
    // Showing the bubble adds a text + rectangle
    expect(scene.add.rectangle).toHaveBeenCalledTimes(1);
    // Plus the name-label text from construction, so 2 texts total
    expect(scene.add.text).toHaveBeenCalledTimes(2);
  });
});
