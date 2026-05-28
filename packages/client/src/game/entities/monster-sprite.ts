import type Phaser from 'phaser';

const HP_BAR_WIDTH = 120;
const HP_BAR_HEIGHT = 10;
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
  private readonly hpBarBg: Phaser.GameObjects.Graphics;
  private readonly hpBarFg: Phaser.GameObjects.Graphics;
  readonly reducedMotion: boolean;

  private readonly _cx: number;
  private readonly _cy: number;
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
    this._cx = x;
    this._cy = y;

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

    this.hpBarBg = scene.add.graphics();
    this.hpBarFg = scene.add.graphics();
    this._drawHpBar(1.0);
  }

  private _drawHpBar(ratio: number): void {
    const bx = this._cx - HP_BAR_WIDTH / 2;
    const by = this._cy + HP_BAR_Y_OFFSET;

    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(0x222222, 0.9);
    this.hpBarBg.fillRect(bx, by, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    this.hpBarFg.clear();
    const fillWidth = Math.round(HP_BAR_WIDTH * ratio);
    if (fillWidth > 0) {
      const color = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xccaa44 : 0xcc4444;
      this.hpBarFg.fillStyle(color, 1);
      this.hpBarFg.fillRect(bx, by, fillWidth, HP_BAR_HEIGHT);
    }
  }

  setHp(hp: number): void {
    this._hp = hp;
    const ratio = Math.max(0, Math.min(100, hp)) / 100;
    this._drawHpBar(ratio);
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
      targets: [this.nameLabel, this.difficultyBanner, this.hpBarBg, this.hpBarFg],
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
      targets: [this.hpBarBg, this.hpBarFg],
      alpha: 0,
      duration: ESCAPE_DURATION_MS / 2,
    });
  }

  private _destroyAll(): void {
    this.sprite.destroy();
    this.nameLabel.destroy();
    this.difficultyBanner.destroy();
    this.hpBarBg.destroy();
    this.hpBarFg.destroy();
  }

  destroy(): void {
    this._destroyAll();
  }
}
