import Phaser from 'phaser';
import type { SceneKey } from './scene-registry';
import { BootScene } from './scenes/boot-scene';

export function getGameConfig(
  parent: HTMLElement,
  _initialScene: SceneKey,
): Phaser.Types.Core.GameConfig {
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
    scene: [BootScene],
  };
}
