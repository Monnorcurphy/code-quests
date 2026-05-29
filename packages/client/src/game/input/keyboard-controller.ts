import type Phaser from 'phaser';

export type ControllerEvent =
  | 'move-left'
  | 'move-right'
  | 'stop'
  | 'interact'
  | 'back'
  | 'tab-next';

type Listener = () => void;

interface KeyLike {
  isDown: boolean;
}

interface CursorKeysLike {
  left: KeyLike;
  right: KeyLike;
}

interface KeyboardPluginLike {
  disableGlobalCapture?: () => void;
  enableGlobalCapture?: () => void;
}

function isEditableElementFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
}

export class KeyboardController {
  private readonly cursors: CursorKeysLike;
  private readonly aKey: KeyLike;
  private readonly dKey: KeyLike;
  private readonly enterKey: KeyLike;
  private readonly escKey: KeyLike;
  private readonly tabKey: KeyLike;
  private readonly keyboard: KeyboardPluginLike;
  private readonly handleFocusChange: () => void;

  private prevEnter = false;
  private prevEsc = false;
  private prevTab = false;
  private prevMoving: 'left' | 'right' | null = null;

  private readonly listeners = new Map<ControllerEvent, Set<Listener>>();

  constructor(scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard!.createCursorKeys() as CursorKeysLike;
    const keys = scene.input.keyboard!.addKeys('A,D,ENTER,ESC,TAB') as Record<
      string,
      KeyLike
    >;
    this.aKey = keys['A'];
    this.dKey = keys['D'];
    this.enterKey = keys['ENTER'];
    this.escKey = keys['ESC'];
    this.tabKey = keys['TAB'];
    this.keyboard = scene.input.keyboard as unknown as KeyboardPluginLike;

    this.handleFocusChange = () => {
      if (isEditableElementFocused()) {
        this.keyboard.disableGlobalCapture?.();
      } else {
        this.keyboard.enableGlobalCapture?.();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('focusin', this.handleFocusChange);
      document.addEventListener('focusout', this.handleFocusChange);
      this.handleFocusChange();
    }
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
    if (isEditableElementFocused()) {
      if (this.prevMoving !== null) {
        this.emit('stop');
        this.prevMoving = null;
      }
      return;
    }

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
    if (typeof document !== 'undefined') {
      document.removeEventListener('focusin', this.handleFocusChange);
      document.removeEventListener('focusout', this.handleFocusChange);
    }
    this.keyboard.enableGlobalCapture?.();
    this.listeners.clear();
  }
}
