import type Phaser from 'phaser';
import { HpBar } from '../hp-bar';

const HP_BAR_Y_OFFSET = -70;
const NAME_Y_OFFSET = 56;
const STARS_Y_OFFSET = -90;

const VICTORY_DURATION_MS = 1000;
const ESCAPE_DURATION_MS = 800;
const DEFEAT_SHAKE_MS = 500;
const DEFEAT_COMPLETE_MS = 600;

export interface MonsterSpriteOptions {
  reducedMotion?: boolean;
}

export class MonsterSprite {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly difficultyBanner: Phaser.GameObjects.Text;
  private readonly _hpBar: HpBar;
  readonly reducedMotion: boolean;

  private _hp = 100;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    assetKey: string,
    monsterName: string,
    difficulty: 1 | 2 | 3 | 4 | 5,
    options: MonsterSpriteOptions = {},
  ) {
    this.scene = scene;
    this.reducedMotion = options.reducedMotion ?? false;

    this.sprite = scene.add.image(x, y, assetKey);

    const stars = '★'.repeat(difficulty);
    this.difficultyBanner = scene.add
      .text(x, y + STARS_Y_OFFSET, stars, {
        fontSize: '18px',
        color: '#f5deb3',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.nameLabel = scene.add
      .text(x, y + NAME_Y_OFFSET, monsterName, {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this._hpBar = new HpBar(scene, x, y + HP_BAR_Y_OFFSET);
  }

  setHp(hp: number): void {
    this._hp = hp;
    this._hpBar.setRatio(Math.max(0, Math.min(100, hp)) / 100);
  }

  getHp(): number {
    return this._hp;
  }

  playVictory(onComplete: () => void): void {
    if (this.reducedMotion) {
      this._destroyAll();
      onComplete();
      return;
    }
    this.sprite.setTint(0xffffff);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: VICTORY_DURATION_MS,
      onComplete: () => {
        this._destroyAll();
        onComplete();
      },
    });
    this.scene.tweens.add({
      targets: [this.nameLabel, this.difficultyBanner, ...this._hpBar.objects],
      alpha: 0,
      duration: VICTORY_DURATION_MS / 2,
    });
  }

  playDefeat(onComplete: () => void): void {
    if (this.reducedMotion) {
      onComplete();
      return;
    }
    this.scene.cameras.main.shake(DEFEAT_SHAKE_MS, 0.02);
    this.scene.time.delayedCall(DEFEAT_COMPLETE_MS, onComplete);
  }

  playEscape(onComplete: () => void): void {
    if (this.reducedMotion) {
      this._destroyAll();
      onComplete();
      return;
    }
    const slideDistance = this.scene.cameras.main.width + 200;
    this.scene.tweens.add({
      targets: [this.sprite, this.nameLabel, this.difficultyBanner],
      x: `+=${slideDistance}`,
      duration: ESCAPE_DURATION_MS,
      ease: 'Power2',
      onComplete: () => {
        this._destroyAll();
        onComplete();
      },
    });
    this.scene.tweens.add({
      targets: this._hpBar.objects,
      alpha: 0,
      duration: ESCAPE_DURATION_MS / 2,
    });
  }

  private _destroyAll(): void {
    this.sprite.destroy();
    this.nameLabel.destroy();
    this.difficultyBanner.destroy();
    this._hpBar.destroy();
  }

  destroy(): void {
    this._destroyAll();
  }
}
