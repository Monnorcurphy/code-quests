import Phaser from 'phaser';
import { Player } from '../entities/player';
import { KeyboardController } from '../input/keyboard-controller';
import { preloadQuestAssets, preloadMonsterAssets } from '../asset-loader';
import { sceneRouter } from '../scene-router';
import { CombatLayer } from '../combat-layer';
import type { QuestSceneKey } from '../scene-registry';
import type { AssetKey } from '../asset-loader';

const GROUND_Y = 680;
const GROUND_HEIGHT = 80;
const PLAYER_Y = GROUND_Y - GROUND_HEIGHT / 2;
const SCENE_HEIGHT = 720;
const DEFAULT_SPAWN_X = 200;
const FADE_DURATION_MS = 300;
const EDGE_THRESHOLD = 80;
const MONSTER_SPAWN_X_OFFSET = 400;
const MONSTER_SPAWN_Y_OFFSET = 32;

interface SceneInitData {
  spawnX?: number;
}

export abstract class BaseQuestScene extends Phaser.Scene {
  protected player!: Player;
  protected controller!: KeyboardController;
  readonly sceneWidth: number = 2400;

  private _delta = 16;
  private _spawnX = DEFAULT_SPAWN_X;
  private _edgeTriggered = false;
  private _combatLayer: CombatLayer | null = null;

  abstract get sceneKey(): QuestSceneKey;
  abstract get backgroundAssetKey(): AssetKey;
  abstract get groundAssetKey(): AssetKey;
  abstract get nextSceneKey(): QuestSceneKey | null;

  init(data: SceneInitData): void {
    this._spawnX = data.spawnX ?? DEFAULT_SPAWN_X;
    this._edgeTriggered = false;
  }

  preload(): void {
    preloadQuestAssets(this);
    preloadMonsterAssets(this);
  }

  create(): void {
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    this.add.tileSprite(
      this.sceneWidth / 2,
      SCENE_HEIGHT / 2,
      this.sceneWidth,
      SCENE_HEIGHT,
      this.backgroundAssetKey,
    );

    this.add.tileSprite(
      this.sceneWidth / 2,
      GROUND_Y,
      this.sceneWidth,
      GROUND_HEIGHT,
      this.groundAssetKey,
    );

    const sceneBounds = { min: 0, max: this.sceneWidth };
    this.player = new Player(this, this._spawnX, PLAYER_Y, sceneBounds, { reducedMotion });

    this.controller = new KeyboardController(this);
    this.controller
      .on('move-left', () => this.player.moveLeft(this._delta))
      .on('move-right', () => this.player.moveRight(this._delta))
      .on('stop', () => this.player.stop());

    this.cameras.main.fadeIn(reducedMotion ? 0 : FADE_DURATION_MS);

    const questId =
      (this.game?.registry?.get?.('questId') as string | null | undefined) ?? null;

    if (questId) {
      const layer = new CombatLayer(this, questId, {
        monsterX: this.sceneWidth - MONSTER_SPAWN_X_OFFSET,
        monsterY: PLAYER_Y - MONSTER_SPAWN_Y_OFFSET,
        reducedMotion,
      });
      this._combatLayer = layer;
      this.events.once('shutdown', () => layer.destroy());
    }
  }

  update(_time: number, delta: number): void {
    this._delta = delta;
    this.controller.update();

    const next = this.nextSceneKey;
    if (!this._edgeTriggered && !this._combatLayer?.encounterActive && next !== null) {
      if (this.player.getX() >= this.sceneWidth - EDGE_THRESHOLD) {
        this._edgeTriggered = true;
        sceneRouter.requestSceneAdvance({ fromScene: this.sceneKey, toScene: next });
      }
    }
  }
}
