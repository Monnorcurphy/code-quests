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

    if (scene.textures.exists('tex-recruit-banner')) {
      const img = scene.add.image(x, y, 'tex-recruit-banner').setDepth(0);
      img.setDisplaySize(WIDTH, HEIGHT);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => this.activate());
      this.body = img as unknown as Phaser.GameObjects.Rectangle;
    } else {
      this.body = scene.add
        .rectangle(x, y, WIDTH, HEIGHT, COLOR_IDLE, ALPHA_IDLE)
        .setDepth(0)
        .setInteractive({ useHandCursor: true });
      this.body.on('pointerdown', () => this.activate());
    }

    this.outline = scene.add
      .rectangle(x, y, WIDTH + OUTLINE_STROKE * 2, HEIGHT + OUTLINE_STROKE * 2)
      .setDepth(1)
      .setStrokeStyle(OUTLINE_STROKE, OUTLINE_COLOR, 0)
      .setFillStyle(0, 0);

    scene.add
      .text(x, y + TEXT_Y_OFFSET, 'Recruit\nBanner', {
        fontSize: '12px',
        color: '#fef9e7',
        align: 'center',
        fontStyle: 'bold',
        backgroundColor: '#1a0e08',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(3);
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
    const setFillStyle = (this.body as { setFillStyle?: (c: number, a: number) => void }).setFillStyle;
    if (typeof setFillStyle === 'function') {
      const color = nowInRange ? COLOR_HIGHLIGHT : COLOR_IDLE;
      const alpha = nowInRange ? ALPHA_HIGHLIGHT : ALPHA_IDLE;
      setFillStyle.call(this.body, color, alpha);
    } else {
      (this.body as { setAlpha?: (a: number) => void }).setAlpha?.(
        nowInRange ? ALPHA_HIGHLIGHT : ALPHA_IDLE,
      );
    }
    this.outline.setStrokeStyle(OUTLINE_STROKE, OUTLINE_COLOR, nowInRange ? 1 : 0);
  }

  activate(): void {
    useTownStore.getState().setActiveModal('recruit');
  }
}
