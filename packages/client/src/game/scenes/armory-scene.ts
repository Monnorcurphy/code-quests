import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

export class ArmoryScene extends BaseBuildingScene {
  constructor() {
    super({ key: 'armory' });
  }

  override get sceneKey(): SceneKey {
    return 'armory';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#0a0c14');
    this.addReturnSignText();

    // Weapon racks along the wall
    this.add.rectangle(500, 220, 30, 200, 0x202840, 0.8).setDepth(0);
    this.add.rectangle(600, 220, 30, 200, 0x202840, 0.8).setDepth(0);
    this.add.rectangle(800, 220, 30, 200, 0x202840, 0.8).setDepth(0);
    this.add.rectangle(900, 220, 30, 200, 0x202840, 0.8).setDepth(0);
    this.add.text(700, 80, 'The Armory', { fontSize: '28px', color: '#a0b8d0', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    // Armor stand
    this.add.rectangle(700, BUILDING_DOOR_Y - 25, 55, 80, 0x304860, 0.85).setDepth(0);
    this.add
      .text(700, BUILDING_DOOR_Y - 25, '⚔', { fontSize: '22px', color: '#c0d8e8' })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(700, BUILDING_DOOR_Y - 90, 'Armor\nStand', { fontSize: '11px', color: '#a0b8d0', align: 'center' })
      .setOrigin(0.5)
      .setDepth(2);

    sceneRouter.setInteractives([this.returnDoorInteractive]);

    useTownStore.getState().setActiveModal('coming-soon');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('armory', ArmoryScene);
