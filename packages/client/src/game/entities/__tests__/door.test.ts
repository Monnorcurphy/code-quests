import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Door } from '../door';
import type Phaser from 'phaser';

vi.mock('../../scene-router', () => ({
  sceneRouter: {
    emitDoorEnter: vi.fn(),
  },
}));

import { sceneRouter } from '../../scene-router';

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

function makeMockScene(): Phaser.Scene {
  const rect = makeRect();
  return {
    add: {
      rectangle: vi.fn(() => rect),
    },
  } as unknown as Phaser.Scene;
}

describe('Door', () => {
  let scene: Phaser.Scene;

  beforeEach(() => {
    scene = makeMockScene();
    vi.mocked(sceneRouter.emitDoorEnter).mockClear();
  });

  it('is not in range initially', () => {
    const door = new Door(scene, {
      x: 500,
      y: 592,
      targetScene: 'war-room',
      targetSpawnX: 200,
      label: 'Door to War Room',
    });

    expect(door.inRange).toBe(false);
  });

  it('enters range when player is within interact radius', () => {
    const door = new Door(scene, {
      x: 500,
      y: 592,
      targetScene: 'war-room',
      targetSpawnX: 200,
      label: 'Door to War Room',
    });

    door.update(490);

    expect(door.inRange).toBe(true);
  });

  it('leaves range when player moves away', () => {
    const door = new Door(scene, {
      x: 500,
      y: 592,
      targetScene: 'war-room',
      targetSpawnX: 200,
      label: 'Door to War Room',
    });

    door.update(490);
    expect(door.inRange).toBe(true);

    door.update(900);
    expect(door.inRange).toBe(false);
  });

  it('tryEnter emits door enter when in range', () => {
    const door = new Door(scene, {
      x: 500,
      y: 592,
      targetScene: 'oracle',
      targetSpawnX: 300,
      label: 'Door to Oracle',
    });

    door.update(490);
    door.tryEnter();

    expect(sceneRouter.emitDoorEnter).toHaveBeenCalledWith({
      sceneKey: 'oracle',
      spawnX: 300,
    });
  });

  it('tryEnter does nothing when not in range', () => {
    const door = new Door(scene, {
      x: 500,
      y: 592,
      targetScene: 'war-room',
      targetSpawnX: 200,
      label: 'Door to War Room',
    });

    door.tryEnter();

    expect(sceneRouter.emitDoorEnter).not.toHaveBeenCalled();
  });

  it('exposes label and x', () => {
    const door = new Door(scene, {
      x: 700,
      y: 592,
      targetScene: 'guild-hall',
      targetSpawnX: 150,
      label: 'Door to Guild Hall',
    });

    expect(door.label).toBe('Door to Guild Hall');
    expect(door.x).toBe(700);
  });
});
