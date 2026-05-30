import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { EquipmentStationInteractive } from '../interactives/equipment-station';
import { GuideNpc } from '../entities/guide-npc';
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
    this.cameras.main.setBackgroundColor('#10121c');
    this.addReturnSignText();

    // Stone wall texture
    this.add.rectangle(640, 240, 1280, 360, 0x303644).setDepth(-1);
    for (let x = 60; x < 1280; x += 60) {
      this.add.rectangle(x, 200 + ((x / 60) % 2) * 20, 50, 30, 0x252a36).setDepth(-1);
    }

    // Weapon rack frame (horizontal beam + supports)
    this.add.rectangle(640, 170, 900, 12, 0x4a3614).setDepth(0);
    this.add.rectangle(640, 350, 900, 12, 0x4a3614).setDepth(0);
    this.add.rectangle(190, 260, 8, 200, 0x4a3614).setDepth(0);
    this.add.rectangle(1090, 260, 8, 200, 0x4a3614).setDepth(0);

    // Swords (3)
    for (const sx of [280, 380, 480]) {
      // blade
      this.add.rectangle(sx, 240, 6, 110, 0xd0d8e8).setDepth(1);
      this.add.rectangle(sx, 240, 4, 108, 0xfaffff).setDepth(2);
      // crossguard
      this.add.rectangle(sx, 290, 24, 5, 0xa07028).setDepth(2);
      // grip
      this.add.rectangle(sx, 305, 5, 22, 0x3a2410).setDepth(2);
      // pommel
      this.add.circle(sx, 320, 4, 0xa07028).setDepth(2);
    }

    // Shields (2)
    for (const sx of [580, 680]) {
      this.add.circle(sx, 250, 28, 0x4a4658).setDepth(1);
      this.add.circle(sx, 250, 24, 0x6a3814).setDepth(2);
      // boss
      this.add.circle(sx, 250, 6, 0xc4a050).setDepth(3);
      // cross emblem
      this.add.rectangle(sx, 250, 4, 30, 0xc4a050).setDepth(3);
      this.add.rectangle(sx, 250, 30, 4, 0xc4a050).setDepth(3);
    }

    // Bow — actual curved bow shape (made of two arc segments + bowstring)
    // instead of a giant ring. The bow leans against the wall vertically.
    // Upper limb (curved arc — built from short rectangles for a wood look)
    const bowX = 810;
    const bowCy = 250;
    for (let i = 0; i < 10; i++) {
      const t = i / 9; // 0 to 1
      const y = bowCy - 40 + t * 40; // upper half
      // Curve outward toward the middle, taper at the tip
      const xOff = Math.sin(t * Math.PI) * 14;
      const wid = Math.max(2, Math.round(4 - Math.abs(t - 0.5) * 4));
      this.add.rectangle(bowX + xOff, y, wid, 5, 0x6a3814).setDepth(1);
      this.add.rectangle(bowX + xOff, y, wid - 1, 4, 0x8a4828).setDepth(2);
    }
    // Lower limb
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const y = bowCy + t * 40;
      const xOff = Math.sin(t * Math.PI) * 14;
      const wid = Math.max(2, Math.round(4 - Math.abs(t - 0.5) * 4));
      this.add.rectangle(bowX + xOff, y, wid, 5, 0x6a3814).setDepth(1);
      this.add.rectangle(bowX + xOff, y, wid - 1, 4, 0x8a4828).setDepth(2);
    }
    // Grip wrap in the middle
    this.add.rectangle(bowX + 13, bowCy, 6, 14, 0x2a1810).setDepth(3);
    // Bowstring — straight vertical line from top tip to bottom tip
    this.add.line(0, 0, bowX, bowCy - 40, bowX, bowCy + 40, 0xe8e8e8, 0.85).setDepth(2);

    // Arrows in a quiver — beside the bow
    const quiverX = 880;
    this.add.rectangle(quiverX, 290, 32, 60, 0x4a2814).setDepth(1);
    this.add.rectangle(quiverX, 262, 36, 6, 0x3a1f08).setDepth(2);
    // Three arrows poking up out of the quiver
    for (let i = 0; i < 3; i++) {
      const ax = quiverX - 10 + i * 10;
      this.add.rectangle(ax, 235, 2, 50, 0x6a3a14).setDepth(2);
      // Fletching at the bottom
      this.add.triangle(ax, 218, -3, 4, 3, 4, 0, -3, 0xc8c8c8).setDepth(3);
      // Arrowhead at the top
      this.add.triangle(ax, 210, -3, 6, 3, 6, 0, -2, 0xa0a8b8).setDepth(3);
    }

    // Axe
    this.add.rectangle(960, 250, 6, 80, 0x3a2410).setDepth(1);
    this.add.triangle(960, 230, 0, -10, 20, 0, 0, 14, 0xb0b0c0).setDepth(2);
    this.add.triangle(960, 230, 0, -10, -20, 0, 0, 14, 0xb0b0c0).setDepth(2);

    // Anvil on the floor by the workbench
    this.add.rectangle(620, BUILDING_DOOR_Y + 24, 80, 18, 0x303040).setDepth(1);
    this.add.rectangle(620, BUILDING_DOOR_Y + 38, 60, 16, 0x252535).setDepth(1);
    this.add.rectangle(620, BUILDING_DOOR_Y + 50, 90, 6, 0x1a1a25).setDepth(1);

    this.add
      .text(640, 80, 'The Armory', { fontSize: '28px', color: '#a0b8d0', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(2);

    this.equipmentStation = new EquipmentStationInteractive(this, STATION_X, BUILDING_DOOR_Y);
    this.equipmentStation.registerWithPlayer(this.player);

    // Smith Bran — blacksmith standing by the anvil.
    new GuideNpc(this, {
      x: 380,
      y: BUILDING_DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      bubbleText: 'Smith Bran — Blacksmith',
      bubbleWidth: 170,
      onActivate: () => useTownStore.getState().openNpcHint('smith-bran'),
    });

    sceneRouter.setInteractives([
      this.returnDoorInteractive,
      {
        id: 'armory-loadout',
        label: 'Loadout Workbench',
        onActivate: () => this.equipmentStation.activate(),
      },
      {
        id: 'smith-bran',
        label: 'Smith Bran (Blacksmith)',
        onActivate: () => useTownStore.getState().openNpcHint('smith-bran'),
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
