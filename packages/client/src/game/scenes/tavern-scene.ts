import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

export class TavernScene extends BaseBuildingScene {
  constructor() {
    super({ key: 'tavern' });
  }

  override get sceneKey(): SceneKey {
    return 'tavern';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#140800');
    this.addReturnSignText();

    // Hearth on the right wall
    this.add.rectangle(1000, 280, 120, 200, 0x4a1800, 0.8).setDepth(0);
    this.add.rectangle(1000, 340, 60, 80, 0xc04000, 0.6).setDepth(1);
    this.add.text(700, 80, 'The Tavern', { fontSize: '28px', color: '#d4804a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    // Tavern tables
    this.add.rectangle(550, BUILDING_DOOR_Y + 20, 180, 30, 0x4a2808, 0.7).setDepth(0);
    this.add.rectangle(800, BUILDING_DOOR_Y + 20, 180, 30, 0x4a2808, 0.7).setDepth(0);

    // Ale barrel
    this.add.rectangle(700, BUILDING_DOOR_Y - 20, 65, 70, 0x6a3c10, 0.85).setDepth(0);
    this.add
      .text(700, BUILDING_DOOR_Y - 20, '⊕', { fontSize: '20px', color: '#d4804a' })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(700, BUILDING_DOOR_Y - 82, 'Ale\nBarrel', { fontSize: '11px', color: '#d4804a', align: 'center' })
      .setOrigin(0.5)
      .setDepth(2);

    sceneRouter.setInteractives([this.returnDoorInteractive]);

    useTownStore.getState().setActiveModal('coming-soon');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('tavern', TavernScene);
