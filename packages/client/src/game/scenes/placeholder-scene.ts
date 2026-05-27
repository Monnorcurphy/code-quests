import Phaser from 'phaser';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import type { SceneKey } from '../scene-registry';

const BUILDING_NAMES: Partial<Record<SceneKey, string>> = {
  'war-room': 'War Room',
  oracle: 'Oracle',
  library: 'Library',
  tavern: 'Tavern',
  armory: 'Armory',
  'guild-hall': 'Guild Hall',
  'hall-of-returns': 'Hall of Returns',
};

function createPlaceholderScene(key: SceneKey, displayName: string): new () => object {
  class PlaceholderScene extends Phaser.Scene {
    constructor() {
      super({ key });
    }

    create(): void {
      const { width, height } = this.cameras.main;
      this.cameras.main.setBackgroundColor('#2c1810');

      this.add
        .text(width / 2, height / 2 - 40, displayName, {
          fontSize: '48px',
          color: '#f0e6d2',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      this.add
        .text(width / 2, height / 2 + 20, 'Coming soon — press Escape to return', {
          fontSize: '18px',
          color: '#a09070',
        })
        .setOrigin(0.5);

      const escKey = this.input.keyboard!.addKeys('ESC') as { ESC: { isDown: boolean } };
      let prevEsc = false;
      this.events.on('update', () => {
        const down = escKey.ESC.isDown;
        if (down && !prevEsc) {
          sceneRouter.emitDoorEnter({ sceneKey: 'town-square', spawnX: 1600 });
        }
        prevEsc = down;
      });
    }
  }

  return PlaceholderScene;
}

for (const [key, name] of Object.entries(BUILDING_NAMES)) {
  registerScene(key as SceneKey, createPlaceholderScene(key as SceneKey, name));
}
