import Phaser from 'phaser';
import { Player } from '../entities/player';
import { Door } from '../entities/door';
import { KeyboardController } from '../input/keyboard-controller';
import { preloadCommonAssets } from '../asset-loader';
import { useTownStore } from '../../stores/town-store';
import { sceneRouter } from '../scene-router';
import type { SceneKey } from '../scene-registry';

const DEFAULT_SCENE_WIDTH = 2400;
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

  protected get sceneWidth(): number {
    return DEFAULT_SCENE_WIDTH;
  }

  init(data: SceneInitData): void {
    this._spawnX = data.spawnX ?? this.defaultSpawnX;
  }

  preload(): void {
    preloadCommonAssets(this);
  }

  create(): void {
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    const sceneBounds = { min: 0, max: this.sceneWidth };
    this.drawSkyAndLandscape();
    // Ground bed (under the front grass strip)
    this.add.rectangle(this.sceneWidth / 2, GROUND_Y, this.sceneWidth, GROUND_HEIGHT, GROUND_COLOR);
    // Add per-building facades above doors before doors themselves
    this.drawFacades();

    this.player = new Player(this, this._spawnX, PLAYER_Y, sceneBounds, { reducedMotion });

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.sceneWidth, camera.height);
    camera.startFollow(this.player.followTarget, true, 0.15, 0.15);

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

    sceneRouter.setInteractives(
      this.doorConfigs.map((cfg) => ({
        id: cfg.targetScene,
        label: cfg.label,
        onActivate: () =>
          sceneRouter.emitDoorEnter({ sceneKey: cfg.targetScene, spawnX: cfg.targetSpawnX }),
      })),
    );
    this.events.once('shutdown', () => sceneRouter.setInteractives([]));

    this.controller = new KeyboardController(this);
    this.controller
      .on('move-left', () => this.player.moveLeft(this._delta))
      .on('move-right', () => this.player.moveRight(this._delta))
      .on('stop', () => this.player.stop())
      .on('interact', () => this._handleInteract());

    this.cameras.main.fadeIn(reducedMotion ? 0 : FADE_DURATION_MS);
  }

  protected drawSkyAndLandscape(): void {
    // Sky gradient — soft dawn from deep blue to pale gold
    const skyBands = [
      { y: 0, h: 80, color: 0x29406b },
      { y: 80, h: 80, color: 0x4c6a96 },
      { y: 160, h: 80, color: 0x83a3c5 },
      { y: 240, h: 80, color: 0xc5c2b0 },
      { y: 320, h: 60, color: 0xd6c08e },
    ];
    for (const b of skyBands) {
      this.add.rectangle(this.sceneWidth / 2, b.y + b.h / 2, this.sceneWidth, b.h, b.color).setDepth(-10);
    }
    // Distant rolling hills (two layers for depth)
    const hillsBackY = 360;
    const hillsBackColor = 0x6d8264;
    const hillsFrontY = 420;
    const hillsFrontColor = 0x4f6447;
    for (let x = 0; x < this.sceneWidth + 200; x += 220) {
      const wob = ((x * 73) % 90) - 30;
      this.add
        .ellipse(x, hillsBackY + wob, 320, 110, hillsBackColor)
        .setDepth(-9);
    }
    for (let x = -100; x < this.sceneWidth + 200; x += 180) {
      const wob = ((x * 41) % 60) - 20;
      this.add
        .ellipse(x, hillsFrontY + wob, 260, 90, hillsFrontColor)
        .setDepth(-8);
    }
    // Grass strip above ground
    this.add
      .rectangle(this.sceneWidth / 2, 620, this.sceneWidth, 40, 0x4f6a3a)
      .setDepth(-1);
    // Grass tufts (subtle)
    for (let x = 30; x < this.sceneWidth; x += 70) {
      const tuftX = x + ((x * 31) % 50) - 25;
      this.add.ellipse(tuftX, 630, 10, 4, 0x3a5028).setDepth(0);
    }
  }

  protected drawFacades(): void {
    // Town square doors carry per-scene targets; map each door to a building
    // facade texture (generated at boot). Doors without a matching facade
    // simply get no decor (e.g. return-to-town doors in interior scenes).
    for (const cfg of this.doorConfigs) {
      const facadeKey = `town-facade-${cfg.targetScene}`;
      if (!this.textures.exists(facadeKey)) continue;
      this.add
        .image(cfg.x, 500, facadeKey)
        .setDepth(-2)
        .setOrigin(0.5, 1);
    }
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
