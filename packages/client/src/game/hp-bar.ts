import type Phaser from 'phaser';

export const HP_BAR_WIDTH = 120;
const HP_BAR_HEIGHT = 10;

export class HpBar {
  private readonly _bg: Phaser.GameObjects.Graphics;
  private readonly _fg: Phaser.GameObjects.Graphics;
  private readonly _bx: number;
  private readonly _by: number;

  constructor(scene: Phaser.Scene, cx: number, by: number) {
    this._bx = cx - HP_BAR_WIDTH / 2;
    this._by = by;
    this._bg = scene.add.graphics();
    this._fg = scene.add.graphics();
    this._draw(1.0);
  }

  private _draw(ratio: number): void {
    this._bg.clear();
    this._bg.fillStyle(0x222222, 0.9);
    this._bg.fillRect(this._bx, this._by, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    this._fg.clear();
    const fillWidth = Math.round(HP_BAR_WIDTH * ratio);
    if (fillWidth > 0) {
      const color = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xccaa44 : 0xcc4444;
      this._fg.fillStyle(color, 1);
      this._fg.fillRect(this._bx, this._by, fillWidth, HP_BAR_HEIGHT);
    }
  }

  setRatio(ratio: number): void {
    this._draw(Math.max(0, Math.min(1, ratio)));
  }

  get objects(): [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics] {
    return [this._bg, this._fg];
  }

  destroy(): void {
    this._bg.destroy();
    this._fg.destroy();
  }
}
