import type Phaser from 'phaser';

// Stationary tavern patron: sits/stands in place and occasionally surfaces
// a speech-bubble catchphrase. Modelled on WanderingAdventurer's bubble
// scheduling (scene.time.addEvent), minus all movement. Scene owns the
// patron and must call .destroy() on shutdown.

export interface PatronNpcOpts {
  x: number;
  y: number;
  textureKey: string;
  catchphrases: readonly string[];
  flipX?: boolean;
  reducedMotion?: boolean;
}

const BUBBLE_INTERVAL_MIN_MS = 8_000;
const BUBBLE_INTERVAL_MAX_MS = 15_000;
const BUBBLE_DURATION_MS = 3_000;
const BUBBLE_OFFSET_Y = -54;
const BUBBLE_PADDING_X = 8;
const BUBBLE_PADDING_Y = 4;
const BUBBLE_HEIGHT = 22;
const SPRITE_DEPTH = 2;
const BUBBLE_DEPTH = 7;

export class PatronNpc {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly catchphrases: readonly string[];
  private bubble: Phaser.GameObjects.Rectangle | null = null;
  private bubbleText: Phaser.GameObjects.Text | null = null;
  private bubbleHideEvent: Phaser.Time.TimerEvent | null = null;
  private nextBubbleEvent: Phaser.Time.TimerEvent | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene, opts: PatronNpcOpts) {
    this.scene = scene;
    this.catchphrases = opts.catchphrases;

    this.sprite = scene.add
      .sprite(opts.x, opts.y, opts.textureKey)
      .setDepth(SPRITE_DEPTH)
      .setFlipX(opts.flipX ?? false);

    // Soft bobbing — looks alive even when seated. Skip when reduced-motion
    // or when tweens are unavailable (unit-test mocks).
    if (
      !(opts.reducedMotion ?? false) &&
      scene.tweens &&
      typeof scene.tweens.add === 'function'
    ) {
      scene.tweens.add({
        targets: this.sprite,
        y: opts.y - 2,
        duration: 1500 + Math.floor(Math.random() * 400),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this._scheduleNextBubble();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.nextBubbleEvent?.remove(false);
    this.bubbleHideEvent?.remove(false);
    this.bubble?.destroy();
    this.bubbleText?.destroy();
    this.sprite.destroy();
  }

  private _scheduleNextBubble(): void {
    const delay =
      BUBBLE_INTERVAL_MIN_MS +
      Math.random() * (BUBBLE_INTERVAL_MAX_MS - BUBBLE_INTERVAL_MIN_MS);
    this.nextBubbleEvent = this.scene.time.addEvent({
      delay,
      callback: () => {
        if (this.destroyed) return;
        this._showBubble();
        this._scheduleNextBubble();
      },
    });
  }

  private _showBubble(): void {
    if (this.catchphrases.length === 0) return;
    const phrase =
      this.catchphrases[Math.floor(Math.random() * this.catchphrases.length)];
    this._hideBubble();

    const text = this.scene.add
      .text(this.sprite.x, this.sprite.y + BUBBLE_OFFSET_Y, phrase, {
        fontSize: '11px',
        color: '#1a0e08',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(BUBBLE_DEPTH + 1);

    const rect = this.scene.add
      .rectangle(
        this.sprite.x,
        this.sprite.y + BUBBLE_OFFSET_Y,
        text.width + BUBBLE_PADDING_X * 2,
        BUBBLE_HEIGHT + BUBBLE_PADDING_Y * 2,
        0xfef9e7,
      )
      .setStrokeStyle(2, 0x1a0e08)
      .setDepth(BUBBLE_DEPTH);

    this.bubble = rect;
    this.bubbleText = text;

    this.bubbleHideEvent = this.scene.time.addEvent({
      delay: BUBBLE_DURATION_MS,
      callback: () => this._hideBubble(),
    });
  }

  private _hideBubble(): void {
    this.bubble?.destroy();
    this.bubbleText?.destroy();
    this.bubble = null;
    this.bubbleText = null;
    this.bubbleHideEvent?.remove(false);
    this.bubbleHideEvent = null;
  }
}

export const PATRON_CATCHPHRASES = [
  'Another round, innkeep!',
  'Did you hear about the dragon at Karruth?',
  'Adventurers, ha! In my day...',
  'The ale here\'s good enough to die for.',
  '*hic* Yes, that bard is FINE.',
  'Quest got harder, monsters got tougher.',
] as const;
