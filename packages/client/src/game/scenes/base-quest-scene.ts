import Phaser from 'phaser';
import { Player } from '../entities/player';
import { KeyboardController } from '../input/keyboard-controller';
import { preloadQuestAssets, preloadMonsterAssets } from '../asset-loader';
import { sceneRouter } from '../scene-router';
import { CombatLayer } from '../combat-layer';
import { useQuestStore } from '../../stores/quest-store';
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
const DIM_ALPHA = 0.5;
const DIM_DEPTH = 1000;
const REDUCED_OPACITY = '0.7';
const FULL_OPACITY = '1';

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
  private _frozen = false;
  private _dimOverlay: Phaser.GameObjects.Rectangle | null = null;
  private _unsubscribeStore: (() => void) | null = null;
  private _reducedMotion = false;

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
    this._reducedMotion =
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
    this.player = new Player(this, this._spawnX, PLAYER_Y, sceneBounds, {
      reducedMotion: this._reducedMotion,
    });

    this.controller = new KeyboardController(this);
    this.controller
      .on('move-left', () => this.player.moveLeft(this._delta))
      .on('move-right', () => this.player.moveRight(this._delta))
      .on('stop', () => this.player.stop());

    this.cameras.main.fadeIn(this._reducedMotion ? 0 : FADE_DURATION_MS);

    const questId =
      (this.game?.registry?.get?.('questId') as string | null | undefined) ?? null;

    if (questId) {
      const layer = new CombatLayer(this, questId, {
        monsterX: this.sceneWidth - MONSTER_SPAWN_X_OFFSET,
        monsterY: PLAYER_Y - MONSTER_SPAWN_Y_OFFSET,
        reducedMotion: this._reducedMotion,
      });
      this._combatLayer = layer;
      this.events.once('shutdown', () => layer.destroy());

      if (!this._reducedMotion) {
        this._dimOverlay = this.add.rectangle(
          this.sceneWidth / 2,
          SCENE_HEIGHT / 2,
          this.sceneWidth,
          SCENE_HEIGHT,
          0x000000,
          DIM_ALPHA,
        );
        this._dimOverlay.setDepth(DIM_DEPTH);
        this._dimOverlay.setVisible(false);
      }

      // Apply initial freeze state if the quest is already paused/blocked
      const initialStatus = useQuestStore.getState().statusByQuest[questId];
      this._applyFreezeState(
        initialStatus === 'paused_input' || initialStatus === 'user_blocked',
      );

      this._unsubscribeStore = useQuestStore.subscribe((state) => {
        const status = state.statusByQuest[questId];
        this._applyFreezeState(status === 'paused_input' || status === 'user_blocked');
      });
      this.events.once('shutdown', () => {
        this._unsubscribeStore?.();
        this._unsubscribeStore = null;
      });
    }
  }

  private _applyFreezeState(shouldFreeze: boolean): void {
    if (shouldFreeze === this._frozen) return;
    this._frozen = shouldFreeze;

    if (shouldFreeze) {
      this.tweens?.pauseAll();
      this.player?.pauseAnimations();
      if (this._reducedMotion) {
        if (this.game?.canvas) {
          this.game.canvas.style.opacity = REDUCED_OPACITY;
        }
      } else {
        this._dimOverlay?.setVisible(true);
      }
    } else {
      this.tweens?.resumeAll();
      this.player?.resumeAnimations();
      if (this._reducedMotion) {
        if (this.game?.canvas) {
          this.game.canvas.style.opacity = FULL_OPACITY;
        }
      } else {
        this._dimOverlay?.setVisible(false);
      }
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
