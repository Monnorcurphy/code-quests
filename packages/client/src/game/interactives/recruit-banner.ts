import Phaser from 'phaser';
import { useTownStore } from '../../stores/town-store';
import type { Player } from '../entities/player';

const WIDTH = 80;
const HEIGHT = 70;
const INTERACT_RADIUS = 60;
const COLOR_IDLE = 0x006400;
const COLOR_HIGHLIGHT = 0x00a000;
const ALPHA_IDLE = 0.7;
const ALPHA_HIGHLIGHT = 0.95;
const OUTLINE_STROKE = 3;
const OUTLINE_COLOR = 0xffd700;
const TEXT_Y_OFFSET = -55;

export class RecruitBannerInteractive {
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly outline: Phaser.GameObjects.Rectangle;
  readonly x: number;
  private _inRange = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.x = x;

    this.body = scene.add
      .rectangle(x, y, WIDTH, HEIGHT, COLOR_IDLE, ALPHA_IDLE)
      .setDepth(0)
      .setInteractive({ useHandCursor: true });

    this.body.on('pointerdown', () => this.activate());

    this.outline = scene.add
      .rectangle(x, y, WIDTH + OUTLINE_STROKE * 2, HEIGHT + OUTLINE_STROKE * 2)
      .setDepth(1)
      .setStrokeStyle(OUTLINE_STROKE, OUTLINE_COLOR, 0)
      .setFillStyle(0, 0);

    scene.add
      .text(x, y + TEXT_Y_OFFSET, 'Recruit\nBanner', {
        fontSize: '11px',
        color: '#f0e6d2',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  registerWithPlayer(player: Player): void {
    player.onInteract(() => {
      if (this._inRange) this.activate();
    });
  }

  get inRange(): boolean {
    return this._inRange;
  }

  update(playerX: number): void {
    const nowInRange = Math.abs(playerX - this.x) < INTERACT_RADIUS;
    if (nowInRange === this._inRange) return;

    this._inRange = nowInRange;
    const color = nowInRange ? COLOR_HIGHLIGHT : COLOR_IDLE;
    const alpha = nowInRange ? ALPHA_HIGHLIGHT : ALPHA_IDLE;
    this.body.setFillStyle(color, alpha);
    this.outline.setStrokeStyle(OUTLINE_STROKE, OUTLINE_COLOR, nowInRange ? 1 : 0);
  }

  activate(): void {
    useTownStore.getState().setActiveModal('recruit');
  }
}
