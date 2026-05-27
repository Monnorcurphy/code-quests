import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

export class OracleScene extends BaseBuildingScene {
  constructor() {
    super({ key: 'oracle' });
  }

  override get sceneKey(): SceneKey {
    return 'oracle';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#0d0020');
    this.addReturnSignText();

    // Starfield hints on the wall
    this.add.rectangle(760, 200, 500, 300, 0x1a0040, 0.5).setDepth(0);
    this.add.text(760, 160, 'The Oracle', { fontSize: '28px', color: '#c090ff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    // Crystal ball
    this.add.rectangle(760, BUILDING_DOOR_Y - 30, 70, 70, 0x6020a0, 0.85).setDepth(0);
    this.add
      .text(760, BUILDING_DOOR_Y - 30, '✦', { fontSize: '24px', color: '#e0c0ff' })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(760, BUILDING_DOOR_Y - 90, 'Crystal\nBall', { fontSize: '11px', color: '#d0a0ff', align: 'center' })
      .setOrigin(0.5)
      .setDepth(2);

    sceneRouter.setInteractives([this.returnDoorInteractive]);

    useTownStore.getState().setActiveModal('coming-soon');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('oracle', OracleScene);
