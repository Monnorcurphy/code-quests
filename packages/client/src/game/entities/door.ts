import Phaser from 'phaser';
import type { SceneKey } from '../scene-registry';
import { sceneRouter } from '../scene-router';

export interface DoorOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  targetScene: SceneKey;
  targetSpawnX: number;
  label: string;
}

const DEFAULT_DOOR_WIDTH = 64;
const DEFAULT_DOOR_HEIGHT = 96;
const INTERACT_RADIUS = 60;
const COLOR_DOOR = 0x8b6914;
const COLOR_HIGHLIGHT = 0xffd700;
const ALPHA_IDLE = 0.6;
const ALPHA_HIGHLIGHT = 0.9;
const OUTLINE_STROKE = 3;

export class Door {
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly outline: Phaser.GameObjects.Rectangle;
  private readonly targetScene: SceneKey;
  private readonly targetSpawnX: number;
  readonly label: string;
  readonly x: number;
  private _inRange = false;

  constructor(scene: Phaser.Scene, opts: DoorOptions) {
    const w = opts.width ?? DEFAULT_DOOR_WIDTH;
    const h = opts.height ?? DEFAULT_DOOR_HEIGHT;
    this.x = opts.x;
    this.targetScene = opts.targetScene;
    this.targetSpawnX = opts.targetSpawnX;
    this.label = opts.label;

    this.body = scene.add
      .rectangle(opts.x, opts.y, w, h, COLOR_DOOR, ALPHA_IDLE)
      .setDepth(0)
      .setInteractive({ useHandCursor: true });

    this.body.on('pointerdown', () => this.enter());

    this.outline = scene.add
      .rectangle(opts.x, opts.y, w + OUTLINE_STROKE * 2, h + OUTLINE_STROKE * 2)
      .setDepth(1)
      .setStrokeStyle(OUTLINE_STROKE, COLOR_HIGHLIGHT, 0)
      .setFillStyle(0, 0);
  }

  enter(): void {
    sceneRouter.emitDoorEnter({ sceneKey: this.targetScene, spawnX: this.targetSpawnX });
  }

  get inRange(): boolean {
    return this._inRange;
  }

  update(playerX: number): void {
    const nowInRange = Math.abs(playerX - this.x) < INTERACT_RADIUS;
    if (nowInRange === this._inRange) return;

    this._inRange = nowInRange;
    const alpha = nowInRange ? ALPHA_HIGHLIGHT : ALPHA_IDLE;
    this.body.setAlpha(alpha);
    this.outline.setStrokeStyle(OUTLINE_STROKE, COLOR_HIGHLIGHT, nowInRange ? 1 : 0);
  }

  tryEnter(): void {
    if (!this._inRange) return;
    this.enter();
  }
}
