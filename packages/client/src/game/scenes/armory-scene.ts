import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { EquipmentStationInteractive } from '../interactives/equipment-station';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

const STATION_X = 700;

export class ArmoryScene extends BaseBuildingScene {
  private equipmentStation!: EquipmentStationInteractive;

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
    this.add
      .text(700, 80, 'The Armory', { fontSize: '28px', color: '#a0b8d0', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(2);

    this.equipmentStation = new EquipmentStationInteractive(this, STATION_X, BUILDING_DOOR_Y);
    this.equipmentStation.registerWithPlayer(this.player);

    sceneRouter.setInteractives([
      this.returnDoorInteractive,
      {
        id: 'armory-loadout',
        label: 'Loadout Workbench',
        onActivate: () => this.equipmentStation.activate(),
      },
    ]);

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }

  override update(_time: number, delta: number): void {
    if (useTownStore.getState().activeModal !== null) return;
    super.update(_time, delta);
    this.equipmentStation.update(this.player.getX());
  }
}

registerScene('armory', ArmoryScene);
