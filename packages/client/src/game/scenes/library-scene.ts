import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

export class LibraryScene extends BaseBuildingScene {
  constructor() {
    super({ key: 'library' });
  }

  override get sceneKey(): SceneKey {
    return 'library';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#100c04');
    this.addReturnSignText();

    // Bookshelves along the back wall
    this.add.rectangle(500, 220, 120, 220, 0x3c2808, 0.8).setDepth(0);
    this.add.rectangle(700, 220, 120, 220, 0x3c2808, 0.8).setDepth(0);
    this.add.rectangle(900, 220, 120, 220, 0x3c2808, 0.8).setDepth(0);
    this.add.text(700, 80, 'The Library', { fontSize: '28px', color: '#e8c870', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    // Open tome on a stand
    this.add.rectangle(700, BUILDING_DOOR_Y - 20, 80, 55, 0x7a5c28, 0.8).setDepth(0);
    this.add
      .text(700, BUILDING_DOOR_Y - 20, '≡', { fontSize: '22px', color: '#f0e6d2' })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(700, BUILDING_DOOR_Y - 78, 'Ancient\nTome', { fontSize: '11px', color: '#e8c870', align: 'center' })
      .setOrigin(0.5)
      .setDepth(2);

    sceneRouter.setInteractives([
      {
        id: 'ancient-tome',
        label: 'Ancient Tome',
        onActivate: () => useTownStore.getState().setActiveModal('library'),
      },
      this.returnDoorInteractive,
    ]);

    useTownStore.getState().setActiveModal('library');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('library', LibraryScene);
