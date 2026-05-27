import Phaser from 'phaser';
import type { SceneKey } from './scene-registry';
import { getSceneList, getScene } from './scene-registry';
import { BootScene } from './scenes/boot-scene';
import './scenes/town-square-scene';
import './scenes/placeholder-scene';

export function getGameConfig(
  parent: HTMLElement,
  initialScene: SceneKey,
): Phaser.Types.Core.GameConfig {
  const allScenes = getSceneList()
    .map((key) => getScene(key))
    .filter((s): s is new () => object => s !== undefined);
  const scenes: (new () => object)[] = [BootScene, ...allScenes.filter((s) => s !== BootScene)];
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
