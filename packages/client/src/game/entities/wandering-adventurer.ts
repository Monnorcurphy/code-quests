import type Phaser from 'phaser';
import { ASSET_KEYS } from '../asset-loader';

// Idle adventurer sprite that paces back and forth in Town Square and
// occasionally pops a speech-bubble catchphrase. Lifecycle: scene owns
// it, must call .destroy() on shutdown or when the adventurer becomes
// busy. Self-schedules its own movement turns and bubble timers via
// scene.time.addEvent so we don't need to drive it from scene.update().

export interface WanderingAdventurerOpts {
  id: string;
  name: string;
  x: number;
  y: number;
  bounds: { min: number; max: number };
  catchphrases: readonly string[];
  reducedMotion?: boolean;
}

const SPEED = 30; // px/sec — leisurely stroll
const TURN_MIN_MS = 4_000;
const TURN_MAX_MS = 9_000;
const BUBBLE_INTERVAL_MIN_MS = 12_000;
const BUBBLE_INTERVAL_MAX_MS = 30_000;
const BUBBLE_DURATION_MS = 4_000;
const BUBBLE_OFFSET_Y = -54;
const BUBBLE_PADDING_X = 8;
const BUBBLE_PADDING_Y = 4;
const BUBBLE_HEIGHT = 22;
const SPRITE_DEPTH = 4;
const BUBBLE_DEPTH = 8;
const LABEL_OFFSET_Y = -30;

export class WanderingAdventurer {
  readonly id: string;
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly bounds: { min: number; max: number };
  private readonly catchphrases: readonly string[];
  private readonly reducedMotion: boolean;
  private bubble: Phaser.GameObjects.Rectangle | null = null;
  private bubbleText: Phaser.GameObjects.Text | null = null;
  private bubbleHideEvent: Phaser.Time.TimerEvent | null = null;
  private nextBubbleEvent: Phaser.Time.TimerEvent | null = null;
  private nextTurnEvent: Phaser.Time.TimerEvent | null = null;
  private movingRight: boolean;
  private destroyed = false;

  constructor(scene: Phaser.Scene, opts: WanderingAdventurerOpts) {
    this.scene = scene;
    this.id = opts.id;
    this.bounds = opts.bounds;
    this.catchphrases = opts.catchphrases;
    this.reducedMotion = opts.reducedMotion ?? false;
    this.movingRight = Math.random() < 0.5;

    this.sprite = scene.add
      .sprite(opts.x, opts.y, ASSET_KEYS.CHARACTER_ADVENTURER_IDLE)
      .setDepth(SPRITE_DEPTH)
      .setFlipX(!this.movingRight);

    // Soft bobbing — looks alive even when standing still
    if (!this.reducedMotion && scene.tweens && typeof scene.tweens.add === 'function') {
      scene.tweens.add({
        targets: this.sprite,
        y: opts.y - 3,
        duration: 1400 + Math.floor(Math.random() * 400),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Tiny name label so the wanderer is identifiable
    this.nameLabel = scene.add
      .text(opts.x, opts.y + LABEL_OFFSET_Y, opts.name, {
        fontSize: '10px',
        color: '#fef9e7',
        backgroundColor: '#1a0e08',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(SPRITE_DEPTH + 1);

    this._scheduleNextTurn();
    this._scheduleNextBubble();
  }

  /** Per-frame walk step driven by the scene's update loop. */
  update(deltaMs: number): void {
    if (this.destroyed) return;
    const dx = (SPEED * deltaMs) / 1000;
    let nextX = this.sprite.x + (this.movingRight ? dx : -dx);
    if (nextX <= this.bounds.min) {
      nextX = this.bounds.min;
      this.movingRight = true;
      this.sprite.setFlipX(false);
    } else if (nextX >= this.bounds.max) {
      nextX = this.bounds.max;
      this.movingRight = false;
      this.sprite.setFlipX(true);
    }
    this.sprite.x = nextX;
    this.nameLabel.x = nextX;
    if (this.bubble) this.bubble.x = nextX;
    if (this.bubbleText) this.bubbleText.x = nextX;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.nextTurnEvent?.remove(false);
    this.nextBubbleEvent?.remove(false);
    this.bubbleHideEvent?.remove(false);
    this.bubble?.destroy();
    this.bubbleText?.destroy();
    this.nameLabel.destroy();
    this.sprite.destroy();
  }

  private _scheduleNextTurn(): void {
    const delay = TURN_MIN_MS + Math.random() * (TURN_MAX_MS - TURN_MIN_MS);
    this.nextTurnEvent = this.scene.time.addEvent({
      delay,
      callback: () => {
        if (this.destroyed) return;
        this.movingRight = !this.movingRight;
        this.sprite.setFlipX(!this.movingRight);
        this._scheduleNextTurn();
      },
    });
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
    const phrase = this.catchphrases[Math.floor(Math.random() * this.catchphrases.length)];
    // Drop any previous bubble before showing a new one
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

    const textWidth = text.width;
    const rect = this.scene.add
      .rectangle(
        this.sprite.x,
        this.sprite.y + BUBBLE_OFFSET_Y,
        textWidth + BUBBLE_PADDING_X * 2,
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

export const WANDERER_CATCHPHRASES = [
  'My blade thirsts for adventure!',
  'Anyone seen my horse?',
  'Heard there\'s a goblin problem in the north.',
  'Got any quests for me?',
  'Bards make the best dinner guests.',
  'I once slew a wraith with a wooden spoon.',
  'Better to die fighting than to live in fear.',
  'The Oracle says I\'ll be famous one day.',
  'Got that lich a-skulking \'round my dreams again.',
  'Anyone got a healing potion to spare?',
  'Two coppers says the next quest goes sideways.',
  'I miss the smell of dungeon moss.',
  'Reckon I\'ve still got one good boss fight in me.',
] as const;
