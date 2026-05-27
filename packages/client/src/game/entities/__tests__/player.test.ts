import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Player } from '../player';
import type { PlayerBounds } from '../player';
import type Phaser from 'phaser';

interface MockSprite {
  x: number;
  y: number;
  setFlipX: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
}

function makeMockSprite(): MockSprite {
  return {
    x: 0,
    y: 0,
    setFlipX: vi.fn(),
    play: vi.fn(),
  };
}

function makeMockScene(sprite: MockSprite): Phaser.Scene {
  return {
    add: { sprite: vi.fn(() => sprite) },
    anims: { exists: vi.fn(() => false), create: vi.fn() },
  } as unknown as Phaser.Scene;
}

const BOUNDS: PlayerBounds = { min: 0, max: 2400 };

describe('Player', () => {
  let sprite: MockSprite;
  let scene: Phaser.Scene;

  beforeEach(() => {
    sprite = makeMockSprite();
    scene = makeMockScene(sprite);
  });

  it('getX() returns initial x position', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    expect(player.getX()).toBe(100);
  });

  it('moveRight increases x by speed * delta/1000', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { speed: 200, reducedMotion: false });
    player.moveRight(1000);
    expect(player.getX()).toBe(300);
  });

  it('moveLeft decreases x by speed * delta/1000', () => {
    const player = new Player(scene, 500, 500, BOUNDS, { speed: 200, reducedMotion: false });
    player.moveLeft(1000);
    expect(player.getX()).toBe(300);
  });

  it('movement is clamped to min bound', () => {
    const player = new Player(scene, 50, 500, BOUNDS, { speed: 200, reducedMotion: false });
    player.moveLeft(2000);
    expect(player.getX()).toBe(0);
  });

  it('movement is clamped to max bound', () => {
    const player = new Player(scene, 2350, 500, BOUNDS, { speed: 200, reducedMotion: false });
    player.moveRight(2000);
    expect(player.getX()).toBe(2400);
  });

  it('setX() clamps below min to min', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    player.setX(-100);
    expect(player.getX()).toBe(0);
  });

  it('setX() clamps above max to max', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    player.setX(9999);
    expect(player.getX()).toBe(2400);
  });

  it('moveRight sets facing to right', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    player.moveLeft(16);
    player.moveRight(16);
    expect(player.facing).toBe('right');
  });

  it('moveLeft sets facing to left', () => {
    const player = new Player(scene, 200, 500, BOUNDS, { reducedMotion: false });
    player.moveLeft(16);
    expect(player.facing).toBe('left');
  });

  it('moveRight sets sprite flipX to false', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    player.moveRight(16);
    expect(sprite.setFlipX).toHaveBeenCalledWith(false);
  });

  it('moveLeft sets sprite flipX to true', () => {
    const player = new Player(scene, 200, 500, BOUNDS, { reducedMotion: false });
    player.moveLeft(16);
    expect(sprite.setFlipX).toHaveBeenCalledWith(true);
  });

  it('moveRight plays player-walk animation', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    sprite.play.mockClear();
    player.moveRight(16);
    expect(sprite.play).toHaveBeenCalledWith('player-walk', true);
  });

  it('stop plays player-idle animation after moving', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    player.moveRight(16);
    sprite.play.mockClear();
    player.stop();
    expect(sprite.play).toHaveBeenCalledWith('player-idle', true);
  });

  it('animation does not re-play when already on that animation', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    player.moveRight(16);
    sprite.play.mockClear();
    player.moveRight(16);
    expect(sprite.play).not.toHaveBeenCalled();
  });

  it('stop does not play idle if player was not moving', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    sprite.play.mockClear();
    player.stop();
    expect(sprite.play).not.toHaveBeenCalled();
  });

  it('interact triggers all registered callbacks', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    player.onInteract(cb1);
    player.onInteract(cb2);
    player.interact();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('interact does nothing with no callbacks registered', () => {
    const player = new Player(scene, 100, 500, BOUNDS, { reducedMotion: false });
    expect(() => player.interact()).not.toThrow();
  });
});
