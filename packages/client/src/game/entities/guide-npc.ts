import Phaser from 'phaser';

// "Elder Hawthorne" — friendly villager who explains how the town works.
// Click him to open the in-game Help modal. Plain sprite + speech bubble +
// pointerdown handler that sets the React town-store activeModal to 'help'.

interface GuideNpcOpts {
  x: number;
  y: number;
  textureKey: string; // e.g. 'character/npc-villager'
  onActivate: () => void;
  // Optional custom bubble label (defaults to the Elder Hawthorne prompt).
  bubbleText?: string;
  // Optional bubble width override (use when label text is wider than default).
  bubbleWidth?: number;
}

const BUBBLE_W = 140;
const BUBBLE_H = 28;
const BUBBLE_OFFSET_Y = -60;

export class GuideNpc {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly bubble: Phaser.GameObjects.Rectangle;
  private readonly bubbleText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, opts: GuideNpcOpts) {
    this.sprite = scene.add
      .sprite(opts.x, opts.y, opts.textureKey)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => opts.onActivate());

    // Soft bobbing animation so the NPC feels alive (skip if tweens
    // unavailable, e.g. in unit-test mocks)
    if (scene.tweens && typeof scene.tweens.add === 'function') {
      scene.tweens.add({
        targets: this.sprite,
        y: opts.y - 2,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Speech bubble — default "Click me for help", or custom label
    const label = opts.bubbleText ?? '👋 Click me for help';
    const bubbleW = opts.bubbleWidth ?? BUBBLE_W;
    this.bubble = scene.add
      .rectangle(opts.x, opts.y + BUBBLE_OFFSET_Y, bubbleW, BUBBLE_H, 0xfef9e7)
      .setStrokeStyle(2, 0x1a0e08)
      .setDepth(6);
    this.bubbleText = scene.add
      .text(opts.x, opts.y + BUBBLE_OFFSET_Y, label, {
        fontSize: '11px',
        color: '#1a0e08',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(7);

    // Bubble pointer triangle
    const triangle = scene.add
      .triangle(
        opts.x,
        opts.y + BUBBLE_OFFSET_Y + BUBBLE_H / 2 + 4,
        -6, -6,
        6, -6,
        0, 4,
        0xfef9e7,
      )
      .setStrokeStyle(2, 0x1a0e08)
      .setDepth(6);

    // Make bubble clickable too
    this.bubble.setInteractive({ useHandCursor: true });
    this.bubble.on('pointerdown', () => opts.onActivate());
    triangle.setInteractive({ useHandCursor: true });
    triangle.on('pointerdown', () => opts.onActivate());
  }

  destroy(): void {
    this.sprite.destroy();
    this.bubble.destroy();
    this.bubbleText.destroy();
  }
}
