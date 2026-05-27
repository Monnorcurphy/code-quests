import Phaser from 'phaser';
import { registerScene } from '../scene-registry';
import type { SceneKey } from '../scene-registry';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#f0e6d2');

    this.add
      .text(width / 2, height / 2, 'Code Quests', {
        fontSize: '48px',
        color: '#2c1810',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const next = this.game.registry.get('initialScene') as SceneKey | undefined;
    if (next && next !== 'boot') {
      this.scene.start(next);
    }
  }
}

registerScene('boot', BootScene);
