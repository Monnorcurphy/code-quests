import type Phaser from 'phaser';
import { ASSET_KEYS } from '../asset-loader';

export interface PlayerBounds {
  min: number;
  max: number;
}

export interface PlayerOptions {
  speed?: number;
  reducedMotion?: boolean;
  // Texture keys to override the default character/adventurer-* sprites.
  // Used by player-style customization (Help panel wardrobe).
  textureIdleKey?: string;
  textureWalkKey?: string;
}

const DEFAULT_SPEED = 200;
const WALK_FRAME_RATE_NORMAL = 8;
const WALK_FRAME_RATE_REDUCED = 2;
const IDLE_FRAME_RATE = 4;

type AnimKey = 'player-idle' | 'player-walk';

export class Player {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private _x: number;
  private _facing: 'left' | 'right';
  private _moving: boolean;
  private _currentAnim: AnimKey;
  private readonly speed: number;
  private readonly bounds: PlayerBounds;
  readonly reducedMotion: boolean;
  private readonly interactCallbacks: Array<() => void>;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bounds: PlayerBounds,
    options: PlayerOptions = {},
  ) {
    this._x = x;
    this._facing = 'right';
    this._moving = false;
    this._currentAnim = 'player-idle';
    this.speed = options.speed ?? DEFAULT_SPEED;
    this.reducedMotion =
      options.reducedMotion ??
      (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false);
    this.bounds = bounds;
    this.interactCallbacks = [];

    const idleKey = options.textureIdleKey ?? ASSET_KEYS.CHARACTER_ADVENTURER_IDLE;
    const walkKey = options.textureWalkKey ?? ASSET_KEYS.CHARACTER_ADVENTURER_WALK;
    this.sprite = scene.add.sprite(x, y, idleKey);
    this._setupAnimations(scene, idleKey, walkKey);
    this.sprite.play('player-idle');
  }

  private _setupAnimations(scene: Phaser.Scene, idleKey: string, walkKey: string): void {
    const walkFrameRate = this.reducedMotion ? WALK_FRAME_RATE_REDUCED : WALK_FRAME_RATE_NORMAL;

    // Reset any prior animations so a re-styled player picks up the new
    // texture keys instead of replaying the previous palette's frames.
    if (scene.anims.exists('player-idle')) scene.anims.remove('player-idle');
    if (scene.anims.exists('player-walk')) scene.anims.remove('player-walk');

    scene.anims.create({
      key: 'player-idle',
      frames: [{ key: idleKey }],
      frameRate: IDLE_FRAME_RATE,
      repeat: -1,
    });

    scene.anims.create({
      key: 'player-walk',
      frames: [
        { key: idleKey },
        { key: walkKey },
      ],
      frameRate: walkFrameRate,
      repeat: -1,
    });
  }

  private _playAnim(key: AnimKey): void {
    if (this._currentAnim !== key) {
      this._currentAnim = key;
      this.sprite.play(key, true);
    }
  }

  getX(): number {
    return this._x;
  }

  setX(x: number): void {
    // Wraparound: walking off either edge loops to the opposite side.
    const range = this.bounds.max - this.bounds.min;
    if (range > 0) {
      let wrapped = x - this.bounds.min;
      wrapped = ((wrapped % range) + range) % range;
      this._x = wrapped + this.bounds.min;
    } else {
      this._x = x;
    }
    this.sprite.x = this._x;
  }

  get facing(): 'left' | 'right' {
    return this._facing;
  }

  get followTarget(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  onInteract(callback: () => void): void {
    this.interactCallbacks.push(callback);
  }

  interact(): void {
    for (const cb of this.interactCallbacks) cb();
  }

  moveLeft(delta: number): void {
    this._facing = 'left';
    this._moving = true;
    const newX = this._x - this.speed * (delta / 1000);
    this.setX(newX);
    this.sprite.setFlipX(true);
    this._playAnim('player-walk');
  }

  moveRight(delta: number): void {
    this._facing = 'right';
    this._moving = true;
    const newX = this._x + this.speed * (delta / 1000);
    this.setX(newX);
    this.sprite.setFlipX(false);
    this._playAnim('player-walk');
  }

  stop(): void {
    if (this._moving) {
      this._moving = false;
      this._playAnim('player-idle');
    }
  }

  pauseAnimations(): void {
    this.sprite.anims.pause();
  }

  resumeAnimations(): void {
    this.sprite.anims.resume();
  }
}
