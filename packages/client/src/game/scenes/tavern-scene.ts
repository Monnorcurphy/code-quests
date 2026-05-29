import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { GuideNpc } from '../entities/guide-npc';
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
    this.cameras.main.setBackgroundColor('#1a0a04');
    this.addReturnSignText();

    // Warm candlelight wash on the back wall
    this.add.rectangle(640, 250, 1200, 360, 0x4a2010, 0.4).setDepth(-1);

    // Stone hearth on right with crackling fire
    this.add.rectangle(1100, 320, 140, 240, 0x4a3018).setDepth(0);
    this.add.rectangle(1100, 320, 130, 230, 0x2a1808).setDepth(0);
    this.add.rectangle(1100, 360, 70, 90, 0x1a0804).setDepth(1);
    // Fire flicker layers
    this.add.triangle(1100, 380, -25, 30, 25, 30, 0, -30, 0xff8030).setDepth(2);
    this.add.triangle(1100, 380, -16, 20, 16, 20, 0, -22, 0xffc060).setDepth(3);
    this.add.triangle(1100, 380, -8, 12, 8, 12, 0, -14, 0xfae870).setDepth(4);
    // Logs
    this.add.rectangle(1085, 400, 30, 8, 0x5a3a14).setDepth(3);
    this.add.rectangle(1115, 405, 30, 8, 0x4a2810).setDepth(3);

    this.add
      .text(640, 80, 'The Tavern', { fontSize: '28px', color: '#d4804a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(2);

    // Wooden tables with mugs
    for (const tx of [380, 580]) {
      this.add.rectangle(tx, BUILDING_DOOR_Y + 30, 160, 14, 0x5a3014).setDepth(0);
      this.add.rectangle(tx, BUILDING_DOOR_Y + 50, 14, 30, 0x3a1f08).setDepth(0);
      // mug on the table
      this.add.rectangle(tx - 30, BUILDING_DOOR_Y + 18, 16, 22, 0x8a5a28).setDepth(1);
      this.add.rectangle(tx - 30, BUILDING_DOOR_Y + 10, 18, 4, 0xf5e7b5).setDepth(2);
      this.add.rectangle(tx + 30, BUILDING_DOOR_Y + 18, 16, 22, 0x8a5a28).setDepth(1);
      this.add.rectangle(tx + 30, BUILDING_DOOR_Y + 10, 18, 4, 0xf5e7b5).setDepth(2);
    }

    // Bar counter on left
    this.add.rectangle(200, BUILDING_DOOR_Y + 36, 240, 28, 0x6a3c14).setDepth(0);
    this.add.rectangle(200, BUILDING_DOOR_Y + 56, 240, 16, 0x3a1f08).setDepth(0);

    // Ale barrel — interactive
    const barrelX = 800;
    const barrelY = BUILDING_DOOR_Y;
    // Barrel body
    const barrel = this.add
      .rectangle(barrelX, barrelY, 70, 80, 0x6a3c10)
      .setStrokeStyle(3, 0x3a1f08)
      .setDepth(1)
      .setInteractive({ useHandCursor: true });
    barrel.on('pointerdown', () => useTownStore.getState().setActiveModal('tavern'));
    // Iron bands
    this.add.rectangle(barrelX, barrelY - 24, 74, 5, 0x2a2a30).setDepth(2);
    this.add.rectangle(barrelX, barrelY, 74, 5, 0x2a2a30).setDepth(2);
    this.add.rectangle(barrelX, barrelY + 24, 74, 5, 0x2a2a30).setDepth(2);
    // Tap
    this.add.rectangle(barrelX + 32, barrelY + 8, 8, 4, 0x8a6a30).setDepth(2);
    this.add
      .text(barrelX, barrelY - 60, 'Ale Barrel', {
        fontSize: '12px', color: '#fef9e7', fontStyle: 'bold',
        backgroundColor: '#1a0e08', padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(3);

    // Two patrons drinking at the bar (just sprites, idle)
    if (this.textures.exists('character/npc-villager')) {
      this.add.sprite(160, BUILDING_DOOR_Y + 4, 'character/npc-villager').setDepth(2);
      this.add.sprite(250, BUILDING_DOOR_Y + 4, 'character/npc-villager').setDepth(2).setFlipX(true);
    }

    // Innkeep Rorek — tavernkeeper between the tables.
    new GuideNpc(this, {
      x: 480,
      y: BUILDING_DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      bubbleText: 'Innkeep Rorek — Tavernkeeper',
      bubbleWidth: 200,
      onActivate: () => useTownStore.getState().setActiveModal('tavern'),
    });

    sceneRouter.setInteractives([
      {
        id: 'ale-barrel',
        label: 'Ale Barrel',
        onActivate: () => useTownStore.getState().setActiveModal('tavern'),
      },
      {
        id: 'innkeep-rorek',
        label: 'Innkeep Rorek (Tavernkeeper)',
        onActivate: () => useTownStore.getState().setActiveModal('tavern'),
      },
      this.returnDoorInteractive,
    ]);

    useTownStore.getState().setActiveModal('tavern');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('tavern', TavernScene);
