import type Phaser from 'phaser';
import { ASSET_KEYS } from '../asset-loader';

export interface PlayerBounds {
  min: number;
  max: number;
}

export interface PlayerOptions {
  speed?: number;
  reducedMotion?: boolean;
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

    this.sprite = scene.add.sprite(x, y, ASSET_KEYS.CHARACTER_ADVENTURER_IDLE);
    this._setupAnimations(scene);
    this.sprite.play('player-idle');
  }

  private _setupAnimations(scene: Phaser.Scene): void {
    const walkFrameRate = this.reducedMotion ? WALK_FRAME_RATE_REDUCED : WALK_FRAME_RATE_NORMAL;

    if (!scene.anims.exists('player-idle')) {
      scene.anims.create({
        key: 'player-idle',
        frames: [{ key: ASSET_KEYS.CHARACTER_ADVENTURER_IDLE }],
        frameRate: IDLE_FRAME_RATE,
        repeat: -1,
      });
    }

    if (!scene.anims.exists('player-walk')) {
      scene.anims.create({
        key: 'player-walk',
        frames: [
          { key: ASSET_KEYS.CHARACTER_ADVENTURER_IDLE },
          { key: ASSET_KEYS.CHARACTER_ADVENTURER_WALK },
        ],
        frameRate: walkFrameRate,
        repeat: -1,
      });
    }
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
    this._x = Math.max(this.bounds.min, Math.min(this.bounds.max, x));
    this.sprite.x = this._x;
  }

  get facing(): 'left' | 'right' {
    return this._facing;
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
}
