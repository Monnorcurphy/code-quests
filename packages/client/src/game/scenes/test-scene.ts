import Phaser from 'phaser';
import { Player } from '../entities/player';
import { KeyboardController } from '../input/keyboard-controller';
import { preloadCommonAssets } from '../asset-loader';
import { useTownStore } from '../../stores/town-store';
import { registerScene } from '../scene-registry';
import type { SceneKey } from '../scene-registry';

const SCENE_BOUNDS = { min: 0, max: 2400 };
const PLAYER_START_X = 200;
const PLAYER_Y = 640;
const GROUND_COLOR = 0x8b4513;
const GROUND_Y = 680;
const GROUND_WIDTH = 2400;
const GROUND_HEIGHT = 80;

class TestScene extends Phaser.Scene {
  private player!: Player;
  private controller!: KeyboardController;
  private _delta = 16;

  constructor() {
    super({ key: 'test-scene' });
  }

  preload(): void {
    preloadCommonAssets(this);
  }

  create(): void {
    this.add.rectangle(GROUND_WIDTH / 2, GROUND_Y, GROUND_WIDTH, GROUND_HEIGHT, GROUND_COLOR);

    this.player = new Player(this, PLAYER_START_X, PLAYER_Y, SCENE_BOUNDS);
    this.controller = new KeyboardController(this);

    this.controller
      .on('move-left', () => this.player.moveLeft(this._delta))
      .on('move-right', () => this.player.moveRight(this._delta))
      .on('stop', () => this.player.stop())
      .on('interact', () => this.player.interact());
  }

  update(_time: number, delta: number): void {
    this._delta = delta;
    this.controller.update();

    const store = useTownStore.getState();
    store.setPlayerX(this.player.getX());
    store.setFacing(this.player.facing);
  }
}

if (import.meta.env.DEV) {
  registerScene('test-scene' as SceneKey, TestScene);
}
