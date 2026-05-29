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
    this.cameras.main.setBackgroundColor('#1a140a');
    this.addReturnSignText();

    // Title
    this.add
      .text(700, 80, 'The Library', { fontSize: '28px', color: '#e8c870', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(2);

    // Three tall bookshelves with rows of books
    for (const shelfX of [400, 700, 1000]) {
      // shelf frame
      this.add.rectangle(shelfX, 280, 160, 320, 0x3c2410).setDepth(0);
      this.add.rectangle(shelfX, 280, 152, 312, 0x5a3818).setDepth(1);
      // 5 horizontal shelves
      for (let i = 0; i < 5; i++) {
        const shelfY = 140 + i * 60;
        // each shelf has a row of book spines
        const colors = [0x7a1818, 0x1a4a78, 0x3a6028, 0x5a3a8a, 0x7a4a0a, 0x6a1a4a, 0x2a6a6a];
        let bx = shelfX - 72;
        for (let b = 0; b < 14; b++) {
          const c = colors[(b + i * 3 + Math.floor(shelfX / 100)) % colors.length]!;
          this.add.rectangle(bx + 5, shelfY, 9, 42, c).setDepth(1);
          bx += 10;
        }
        // shelf board
        this.add.rectangle(shelfX, shelfY + 22, 152, 4, 0x281408).setDepth(1);
      }
    }

    // Reading lectern with the Ancient Tome
    this.add.rectangle(700, BUILDING_DOOR_Y - 4, 60, 60, 0x5a3a14).setDepth(1);
    this.add.triangle(
      700, BUILDING_DOOR_Y - 26,
      -30, 10,
      30, 10,
      0, -10,
      0x6a4a20,
    ).setDepth(1);
    // Open tome — interactive
    const tome = this.add
      .rectangle(700, BUILDING_DOOR_Y - 28, 80, 28, 0xf5e7b5)
      .setStrokeStyle(2, 0x5a3a14)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    tome.on('pointerdown', () => useTownStore.getState().setActiveModal('library'));
    // Spine + page lines
    this.add.line(700, BUILDING_DOOR_Y - 28, -40, 0, 40, 0, 0x5a3a14).setDepth(3);
    this.add
      .text(700, BUILDING_DOOR_Y - 28, '≡', { fontSize: '20px', color: '#5a3a14', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(3);
    this.add
      .text(700, BUILDING_DOOR_Y - 78, 'Ancient Tome', {
        fontSize: '12px', color: '#fef9e7', fontStyle: 'bold',
        backgroundColor: '#1a0e08', padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(3);

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
