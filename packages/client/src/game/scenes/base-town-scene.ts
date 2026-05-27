import Phaser from 'phaser';
import { Player } from '../entities/player';
import { Door } from '../entities/door';
import { KeyboardController } from '../input/keyboard-controller';
import { preloadCommonAssets } from '../asset-loader';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

const SCENE_WIDTH = 2400;
const SCENE_BOUNDS = { min: 0, max: SCENE_WIDTH };
const GROUND_COLOR = 0x8b7355;
const GROUND_Y = 680;
const GROUND_HEIGHT = 80;
const GROUND_SURFACE_Y = GROUND_Y - GROUND_HEIGHT / 2;
const PLAYER_Y = 640;
const DOOR_HEIGHT = 96;
const DOOR_Y = GROUND_SURFACE_Y - DOOR_HEIGHT / 2;
const FADE_DURATION_MS = 300;

export interface DoorConfig {
  x: number;
  targetScene: SceneKey;
  targetSpawnX: number;
  label: string;
}

interface SceneInitData {
  spawnX?: number;
}

export abstract class BaseTownScene extends Phaser.Scene {
  protected player!: Player;
  protected controller!: KeyboardController;
  protected doors: Door[] = [];
  private _delta = 16;
  private _spawnX = 200;

  abstract get sceneKey(): SceneKey;
  abstract get defaultSpawnX(): number;
  abstract get doorConfigs(): DoorConfig[];

  init(data: SceneInitData): void {
    this._spawnX = data.spawnX ?? this.defaultSpawnX;
  }

  preload(): void {
    preloadCommonAssets(this);
  }

  create(): void {
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    this.cameras.main.setBackgroundColor('#c8b89a');
    this.add.rectangle(SCENE_WIDTH / 2, GROUND_Y, SCENE_WIDTH, GROUND_HEIGHT, GROUND_COLOR);

    this.player = new Player(this, this._spawnX, PLAYER_Y, SCENE_BOUNDS, { reducedMotion });

    this.doors = this.doorConfigs.map(
      (cfg) =>
        new Door(this, {
          x: cfg.x,
          y: DOOR_Y,
          targetScene: cfg.targetScene,
          targetSpawnX: cfg.targetSpawnX,
          label: cfg.label,
        }),
    );

    this.controller = new KeyboardController(this);
    this.controller
      .on('move-left', () => this.player.moveLeft(this._delta))
      .on('move-right', () => this.player.moveRight(this._delta))
      .on('stop', () => this.player.stop())
      .on('interact', () => this._handleInteract());

    this.cameras.main.fadeIn(reducedMotion ? 0 : FADE_DURATION_MS);
  }

  private _handleInteract(): void {
    for (const door of this.doors) {
      door.tryEnter();
    }
    this.player.interact();
  }

  update(_time: number, delta: number): void {
    this._delta = delta;
    this.controller.update();

    const playerX = this.player.getX();
    for (const door of this.doors) {
      door.update(playerX);
    }

    const store = useTownStore.getState();
    store.setPlayerX(playerX);
    store.setFacing(this.player.facing);
  }
}
