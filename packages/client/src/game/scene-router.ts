import type Phaser from 'phaser';
import type { SceneKey } from './scene-registry';

export interface DoorEnterEvent {
  sceneKey: SceneKey;
  spawnX: number;
}

type DoorEnterHandler = (evt: DoorEnterEvent) => void;

// Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE
const FADE_OUT_COMPLETE = 'camerafadeoutcomplete';
const FADE_DURATION_MS = 300;

class SceneRouter {
  private game: Phaser.Game | null = null;
  private readonly doorEnterHandlers = new Set<DoorEnterHandler>();

  init(game: Phaser.Game | null): void {
    this.game = game;
  }

  private get reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  goToScene(key: SceneKey, opts: { spawnX?: number } = {}): void {
    if (!this.game) return;

    const scenes = this.game.scene.getScenes(true) as Phaser.Scene[];
    const current = scenes[0];

    if (current && current.scene.key === key) return;

    const fadeDuration = this.reducedMotion ? 0 : FADE_DURATION_MS;

    if (!current) {
      this.game.scene.start(key, { spawnX: opts.spawnX });
      return;
    }

    if (fadeDuration > 0) {
      current.cameras.main.fadeOut(fadeDuration, 0, 0, 0);
      current.cameras.main.once(FADE_OUT_COMPLETE, () => {
        current.scene.start(key, { spawnX: opts.spawnX });
      });
    } else {
      current.scene.start(key, { spawnX: opts.spawnX });
    }
  }

  emitDoorEnter(evt: DoorEnterEvent): void {
    for (const handler of this.doorEnterHandlers) {
      handler(evt);
    }
  }

  onDoorEnter(handler: DoorEnterHandler): () => void {
    this.doorEnterHandlers.add(handler);
    return () => {
      this.doorEnterHandlers.delete(handler);
    };
  }
}

export const sceneRouter = new SceneRouter();
