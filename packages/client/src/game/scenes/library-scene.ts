import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { GuideNpc } from '../entities/guide-npc';
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

    // Reading lectern + Ancient Tome — clean stack: lectern column + slanted
    // top + open book resting on the slant. No stray lines or triangles.
    // Lectern column
    this.add.rectangle(700, BUILDING_DOOR_Y + 6, 36, 80, 0x4a2c10).setDepth(1);
    this.add.rectangle(700, BUILDING_DOOR_Y + 6, 30, 76, 0x5a3a14).setDepth(2);
    // Lectern top — slanted reading surface
    this.add.rectangle(700, BUILDING_DOOR_Y - 34, 80, 8, 0x4a2c10).setDepth(2);
    this.add.rectangle(700, BUILDING_DOOR_Y - 36, 76, 4, 0x6a4a28).setDepth(3);
    // Open tome resting on the lectern — two pages with a central spine
    const tome = this.add
      .rectangle(700, BUILDING_DOOR_Y - 44, 64, 18, 0xf5e7b5)
      .setStrokeStyle(2, 0x6a4a28)
      .setDepth(4)
      .setInteractive({ useHandCursor: true });
    tome.on('pointerdown', () => useTownStore.getState().setActiveModal('library'));
    // Spine down the middle
    this.add.rectangle(700, BUILDING_DOOR_Y - 44, 2, 18, 0x6a4a28).setDepth(5);
    // A few horizontal lines as faux text on each page
    for (const py of [BUILDING_DOOR_Y - 49, BUILDING_DOOR_Y - 46, BUILDING_DOOR_Y - 43, BUILDING_DOOR_Y - 40]) {
      this.add.rectangle(686, py, 22, 1, 0x8a6a3a).setDepth(5);
      this.add.rectangle(714, py, 22, 1, 0x8a6a3a).setDepth(5);
    }
    this.add
      .text(700, BUILDING_DOOR_Y - 78, 'Ancient Tome', {
        fontSize: '12px', color: '#fef9e7', fontStyle: 'bold',
        backgroundColor: '#1a0e08', padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(3);

    // Sage Mireldine — the librarian. Clickable NPC that opens the Library.
    new GuideNpc(this, {
      x: 1140,
      y: BUILDING_DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      bubbleText: 'Sage Mireldine — Librarian',
      bubbleWidth: 180,
      onActivate: () => useTownStore.getState().openNpcHint('sage-mireldine'),
    });

    sceneRouter.setInteractives([
      {
        id: 'ancient-tome',
        label: 'Ancient Tome',
        onActivate: () => useTownStore.getState().setActiveModal('library'),
      },
      {
        id: 'sage-mireldine',
        label: 'Sage Mireldine (Librarian)',
        onActivate: () => useTownStore.getState().openNpcHint('sage-mireldine'),
      },
      this.returnDoorInteractive,
    ]);

    // No auto-open — user clicks the Ancient Tome (or Sage Mireldine) when ready.

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('library', LibraryScene);
