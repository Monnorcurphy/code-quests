import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

export class HallOfReturnsScene extends BaseBuildingScene {
  constructor() {
    super({ key: 'hall-of-returns' });
  }

  override get sceneKey(): SceneKey {
    return 'hall-of-returns';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#0c0c10');
    this.addReturnSignText();

    // Memorial plaques on the wall
    this.add.rectangle(500, 200, 100, 70, 0x202028, 0.8).setDepth(0);
    this.add.rectangle(640, 200, 100, 70, 0x202028, 0.8).setDepth(0);
    this.add.rectangle(780, 200, 100, 70, 0x202028, 0.8).setDepth(0);
    this.add.rectangle(920, 200, 100, 70, 0x202028, 0.8).setDepth(0);
    this.add.text(700, 80, 'Hall of Returns', { fontSize: '26px', color: '#9090b8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    // Returned quest scrolls
    this.add.rectangle(700, BUILDING_DOOR_Y - 20, 70, 60, 0x28283c, 0.85).setDepth(0);
    this.add
      .text(700, BUILDING_DOOR_Y - 20, '📜', { fontSize: '18px', color: '#b0b0d0' })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(700, BUILDING_DOOR_Y - 78, 'Returned\nScrolls', { fontSize: '11px', color: '#9090b8', align: 'center' })
      .setOrigin(0.5)
      .setDepth(2);

    sceneRouter.setInteractives([this.returnDoorInteractive]);

    useTownStore.getState().setActiveModal('hall-of-returns');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('hall-of-returns', HallOfReturnsScene);
