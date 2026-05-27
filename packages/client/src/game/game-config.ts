import Phaser from 'phaser';
import type { SceneKey } from './scene-registry';
import { getScene } from './scene-registry';
import { BootScene } from './scenes/boot-scene';

export function getGameConfig(
  parent: HTMLElement,
  initialScene: SceneKey,
): Phaser.Types.Core.GameConfig {
  const scenes: (new () => object)[] = [BootScene];
  if (initialScene !== 'boot') {
    const SceneClass = getScene(initialScene);
    if (SceneClass) scenes.push(SceneClass);
  }
  return {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    pixelArt: true,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    parent,
    callbacks: {
      postBoot: (game: Phaser.Game) => {
        game.registry.set('initialScene', initialScene);
      },
    },
    scene: scenes,
  };
}
