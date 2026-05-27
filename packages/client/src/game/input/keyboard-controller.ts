import type Phaser from 'phaser';

export type ControllerEvent =
  | 'move-left'
  | 'move-right'
  | 'stop'
  | 'interact'
  | 'back'
  | 'tab-next';

type Listener = () => void;

export interface KeyboardControllerOptions {
  reducedMotion?: boolean;
}

interface KeyLike {
  isDown: boolean;
}

interface CursorKeysLike {
  left: KeyLike;
  right: KeyLike;
}

export class KeyboardController {
  private readonly cursors: CursorKeysLike;
  private readonly aKey: KeyLike;
  private readonly dKey: KeyLike;
  private readonly enterKey: KeyLike;
  private readonly escKey: KeyLike;
  private readonly tabKey: KeyLike;

  private prevEnter = false;
  private prevEsc = false;
  private prevTab = false;
  private prevMoving: 'left' | 'right' | null = null;

  private readonly listeners = new Map<ControllerEvent, Set<Listener>>();

  readonly reducedMotion: boolean;

  constructor(scene: Phaser.Scene, options: KeyboardControllerOptions = {}) {
    this.reducedMotion =
      options.reducedMotion ??
      (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false);

    this.cursors = scene.input.keyboard!.createCursorKeys() as CursorKeysLike;
    const keys = scene.input.keyboard!.addKeys('W,A,D,ENTER,ESC,TAB') as Record<
      string,
      KeyLike
    >;
    this.aKey = keys['A'];
    this.dKey = keys['D'];
    this.enterKey = keys['ENTER'];
    this.escKey = keys['ESC'];
    this.tabKey = keys['TAB'];
  }

  on(event: ControllerEvent, listener: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: ControllerEvent, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  private emit(event: ControllerEvent): void {
    this.listeners.get(event)?.forEach((fn) => fn());
  }

  update(): void {
    const movingLeft = this.cursors.left.isDown || this.aKey.isDown;
    const movingRight = this.cursors.right.isDown || this.dKey.isDown;

    if (movingLeft) {
      this.emit('move-left');
      this.prevMoving = 'left';
    } else if (movingRight) {
      this.emit('move-right');
      this.prevMoving = 'right';
    } else if (this.prevMoving !== null) {
      this.emit('stop');
      this.prevMoving = null;
    }

    const enterJustDown = this.enterKey.isDown && !this.prevEnter;
    const escJustDown = this.escKey.isDown && !this.prevEsc;
    const tabJustDown = this.tabKey.isDown && !this.prevTab;

    this.prevEnter = this.enterKey.isDown;
    this.prevEsc = this.escKey.isDown;
    this.prevTab = this.tabKey.isDown;

    if (enterJustDown) this.emit('interact');
    if (escJustDown) this.emit('back');
    if (tabJustDown) this.emit('tab-next');
  }

  destroy(): void {
    this.listeners.clear();
  }
}
