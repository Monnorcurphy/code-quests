import Phaser from 'phaser';
import { Player } from '../entities/player';
import { KeyboardController } from '../input/keyboard-controller';
import { preloadQuestAssets, preloadMonsterAssets, monsterTypeIdToAssetKey } from '../asset-loader';
import { sceneRouter } from '../scene-router';
import { useEncounterStore } from '../../stores/encounter-store';
import { MonsterSprite } from '../entities/monster-sprite';
import type { QuestSceneKey } from '../scene-registry';
import type { AssetKey } from '../asset-loader';
import type { ActiveEncounter } from '../../stores/encounter-store';

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
  private _questId: string | null = null;
  private _encounterActive = false;
  private _monsterSprite: MonsterSprite | null = null;
  private _prevEncounter: ActiveEncounter | null = null;
  private _animPlaying = false;

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
    this._questId = questId;

    if (questId) {
      const unsub = useEncounterStore.subscribe((state) => {
        if (!this._questId) return;
        const encounter = (state.byQuest[this._questId] ?? null) as ActiveEncounter | null;
        this._onEncounterChange(encounter);
      });
      this.events.once('shutdown', () => {
        unsub();
        if (this._monsterSprite) {
          this._monsterSprite.destroy();
          this._monsterSprite = null;
        }
      });
    }
  }

  update(_time: number, delta: number): void {
    this._delta = delta;
    this.controller.update();

    const next = this.nextSceneKey;
    if (!this._edgeTriggered && !this._encounterActive && next !== null) {
      if (this.player.getX() >= this.sceneWidth - EDGE_THRESHOLD) {
        this._edgeTriggered = true;
        sceneRouter.requestSceneAdvance({ fromScene: this.sceneKey, toScene: next });
      }
    }
  }

  private _onEncounterChange(encounter: ActiveEncounter | null): void {
    const prev = this._prevEncounter;
    this._prevEncounter = encounter ? { ...encounter } : null;

    // Monster appeared
    if (!prev && encounter) {
      this._spawnMonster(encounter);
      return;
    }

    // Encounter cleared from outside
    if (prev && !encounter) {
      if (this._monsterSprite) {
        this._monsterSprite.destroy();
        this._monsterSprite = null;
      }
      this._encounterActive = false;
      this._animPlaying = false;
      return;
    }

    if (!encounter) return;

    // HP changed
    if (prev && prev.hp !== encounter.hp && this._monsterSprite) {
      this._monsterSprite.setHp(encounter.hp);
    }

    // Outcome resolved
    if (
      prev?.outcome === 'pending' &&
      encounter.outcome !== 'pending' &&
      !this._animPlaying &&
      this._monsterSprite
    ) {
      this._animPlaying = true;
      this._playOutcome(encounter.outcome);
    }
  }

  private _spawnMonster(encounter: ActiveEncounter): void {
    const assetKey =
      monsterTypeIdToAssetKey[encounter.monsterTypeId] ?? 'quest/silhouette-monster-small';
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    this._monsterSprite = new MonsterSprite(
      this,
      this.sceneWidth - MONSTER_SPAWN_X_OFFSET,
      PLAYER_Y - MONSTER_SPAWN_Y_OFFSET,
      assetKey,
      encounter.monsterName,
      encounter.difficulty,
      { reducedMotion },
    );
    this._encounterActive = true;
  }

  private _playOutcome(outcome: 'victory' | 'defeat' | 'escape'): void {
    const sprite = this._monsterSprite!;
    const questId = this._questId!;

    const onComplete = () => {
      this._monsterSprite = null;
      this._encounterActive = false;
      this._animPlaying = false;
      useEncounterStore.getState().clearQuest(questId);
    };

    if (outcome === 'victory') sprite.playVictory(onComplete);
    else if (outcome === 'defeat') sprite.playDefeat(onComplete);
    else sprite.playEscape(onComplete);
  }
}
