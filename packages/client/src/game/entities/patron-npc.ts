import type Phaser from 'phaser';

// Stationary tavern patron: sits/stands in place and occasionally surfaces
// a speech-bubble catchphrase. Modelled on WanderingAdventurer's bubble
// scheduling (scene.time.addEvent), minus all movement. Scene owns the
// patron and must call .destroy() on shutdown.
//
// A shared PatronChorus ensures only one patron speaks at a time, otherwise
// neighbours overlap visually (especially in the cramped tavern).

export interface PatronChorus {
  isAnyoneSpeaking(): boolean;
  beginSpeaking(): void;
  endSpeaking(): void;
}

export function createPatronChorus(): PatronChorus {
  let speaking = 0;
  return {
    isAnyoneSpeaking: () => speaking > 0,
    beginSpeaking: () => { speaking += 1; },
    endSpeaking: () => { speaking = Math.max(0, speaking - 1); },
  };
}

export interface PatronNpcOpts {
  x: number;
  y: number;
  textureKey: string;
  catchphrases: readonly string[];
  flipX?: boolean;
  reducedMotion?: boolean;
  chorus?: PatronChorus;
  // Initial delay before this patron's first bubble. Used by the scene to
  // spread per-patron start times so they don't all schedule from t=0+8s.
  initialDelayMs?: number;
}

const BUBBLE_INTERVAL_MIN_MS = 14_000;
const BUBBLE_INTERVAL_MAX_MS = 28_000;
const BUBBLE_DURATION_MS = 3_200;
const BUBBLE_RETRY_MS = 1_500;
const BUBBLE_WRAP_WIDTH = 140;
const BUBBLE_OFFSET_Y = -56;
const BUBBLE_PADDING_X = 8;
const BUBBLE_PADDING_Y = 4;
const SPRITE_DEPTH = 2;
const BUBBLE_DEPTH = 7;

export class PatronNpc {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly catchphrases: readonly string[];
  private readonly chorus: PatronChorus | null;
  private bubble: Phaser.GameObjects.Rectangle | null = null;
  private bubbleText: Phaser.GameObjects.Text | null = null;
  private bubbleHideEvent: Phaser.Time.TimerEvent | null = null;
  private nextBubbleEvent: Phaser.Time.TimerEvent | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene, opts: PatronNpcOpts) {
    this.scene = scene;
    this.catchphrases = opts.catchphrases;
    this.chorus = opts.chorus ?? null;

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

    // Initial bubble — schedule with a per-patron offset so a row of patrons
    // don't all hit their first bubble in the same 8-15s window.
    const initial = opts.initialDelayMs ?? (BUBBLE_INTERVAL_MIN_MS + Math.random() * BUBBLE_INTERVAL_MAX_MS);
    this._scheduleNextBubble(initial);
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

  private _scheduleNextBubble(delayMs?: number): void {
    const delay =
      delayMs ??
      BUBBLE_INTERVAL_MIN_MS +
        Math.random() * (BUBBLE_INTERVAL_MAX_MS - BUBBLE_INTERVAL_MIN_MS);
    this.nextBubbleEvent = this.scene.time.addEvent({
      delay,
      callback: () => {
        if (this.destroyed) return;
        // If a chorus is shared and another patron is mid-speech, wait a
        // beat and try again rather than overlap.
        if (this.chorus && this.chorus.isAnyoneSpeaking()) {
          this._scheduleNextBubble(BUBBLE_RETRY_MS);
          return;
        }
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
    this.chorus?.beginSpeaking();

    const text = this.scene.add
      .text(this.sprite.x, this.sprite.y + BUBBLE_OFFSET_Y, phrase, {
        fontSize: '11px',
        color: '#1a0e08',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: BUBBLE_WRAP_WIDTH, useAdvancedWrap: true },
      })
      .setOrigin(0.5)
      .setDepth(BUBBLE_DEPTH + 1);

    const rect = this.scene.add
      .rectangle(
        this.sprite.x,
        this.sprite.y + BUBBLE_OFFSET_Y,
        text.width + BUBBLE_PADDING_X * 2,
        text.height + BUBBLE_PADDING_Y * 2,
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
    if (this.bubble || this.bubbleText) {
      this.chorus?.endSpeaking();
    }
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
