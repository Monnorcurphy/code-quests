import { useEncounterStore } from '../stores/encounter-store';
import { MonsterSprite } from './entities/monster-sprite';
import { monsterTypeIdToAssetKey } from './asset-loader';
import type Phaser from 'phaser';
import type { ActiveEncounter } from '../stores/encounter-store';

export interface CombatLayerOptions {
  monsterX: number;
  monsterY: number;
  reducedMotion: boolean;
}

export class CombatLayer {
  private _sprite: MonsterSprite | null = null;
  private _prev: ActiveEncounter | null = null;
  private _animPlaying = false;
  private _active = false;
  private readonly _unsub: () => void;

  get encounterActive(): boolean {
    return this._active;
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly questId: string,
    private readonly opts: CombatLayerOptions,
  ) {
    this._unsub = useEncounterStore.subscribe((state) => {
      const encounter = (state.byQuest[this.questId] ?? null) as ActiveEncounter | null;
      this._onEncounterChange(encounter);
    });
  }

  destroy(): void {
    this._unsub();
    if (this._sprite) {
      this._sprite.destroy();
      this._sprite = null;
    }
    this._active = false;
  }

  private _onEncounterChange(encounter: ActiveEncounter | null): void {
    const prev = this._prev;
    this._prev = encounter ? { ...encounter } : null;

    if (!prev && encounter) {
      this._spawn(encounter);
      return;
    }

    if (prev && !encounter) {
      if (this._sprite) {
        this._sprite.destroy();
        this._sprite = null;
      }
      this._active = false;
      this._animPlaying = false;
      return;
    }

    if (!encounter) return;

    if (prev && prev.hp !== encounter.hp && this._sprite) {
      this._sprite.setHp(encounter.hp);
    }

    if (
      prev?.outcome === 'pending' &&
      encounter.outcome !== 'pending' &&
      !this._animPlaying &&
      this._sprite
    ) {
      this._animPlaying = true;
      this._playOutcome(encounter.outcome);
    }
  }

  private _spawn(encounter: ActiveEncounter): void {
    const assetKey =
      monsterTypeIdToAssetKey[encounter.monsterTypeId] ?? 'quest/silhouette-monster-small';
    this._sprite = new MonsterSprite(
      this.scene,
      this.opts.monsterX,
      this.opts.monsterY,
      assetKey,
      encounter.monsterName,
      encounter.difficulty,
      { reducedMotion: this.opts.reducedMotion },
    );
    this._active = true;
  }

  private _playOutcome(outcome: 'victory' | 'defeat' | 'escape'): void {
    const sprite = this._sprite!;
    const questId = this.questId;

    const onComplete = () => {
      const s = this._sprite;
      this._sprite = null;
      this._active = false;
      this._animPlaying = false;
      if (s) s.destroy();
      useEncounterStore.getState().clearQuest(questId);
    };

    if (outcome === 'victory') sprite.playVictory(onComplete);
    else if (outcome === 'defeat') sprite.playDefeat(onComplete);
    else sprite.playEscape(onComplete);
  }
}
