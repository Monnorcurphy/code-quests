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

    // Bow — D-shape leaning vertically, with a taut bowstring along the
    // straight (left) edge connecting the two tips. Built from short
    // rectangles tracing a half-ellipse that bulges to the right.
    const bowX = 810;
    const bowCy = 250;
    const bowHalfH = 50;
    // Draw the wood limb as a curve from top tip to bottom tip
    for (let i = 0; i <= 20; i++) {
      const t = i / 20; // 0 to 1
      // y goes from -bowHalfH (top tip) to +bowHalfH (bottom tip)
      const y = bowCy - bowHalfH + t * bowHalfH * 2;
      // xOff bulges outward (to the right) at the middle, tapers to 0 at tips
      const xOff = Math.sin(t * Math.PI) * 18;
      this.add.rectangle(bowX + xOff, y, 4, 5, 0x6a3814).setDepth(1);
      this.add.rectangle(bowX + xOff - 1, y, 2, 4, 0x8a4828).setDepth(2);
    }
    // Bowstring runs straight from top tip to bottom tip (both at bowX since
    // sin(0)=sin(π)=0). Slight visible width so it reads as taut string.
    this.add.rectangle(bowX, bowCy, 1, bowHalfH * 2, 0xe8e8e8).setDepth(2);
    // Grip wrap in the middle of the bow's belly (out to the right where the
    // archer's hand would hold)
    this.add.rectangle(bowX + 18, bowCy, 6, 14, 0x2a1810).setDepth(3);

    // Arrows in a quiver — beside the bow
    const quiverX = 880;
    this.add.rectangle(quiverX, 290, 32, 60, 0x4a2814).setDepth(1);
    this.add.rectangle(quiverX, 262, 36, 6, 0x3a1f08).setDepth(2);
    // Three arrows poking up out of the quiver — shaft, small fletching, head
    for (let i = 0; i < 3; i++) {
      const ax = quiverX - 10 + i * 10;
      // Shaft
      this.add.rectangle(ax, 240, 2, 60, 0x6a3a14).setDepth(2);
      // Fletching — small angled feathers (was previously huge triangles)
      this.add.rectangle(ax - 1, 258, 1, 6, 0xd8d8d8).setDepth(3);
      this.add.rectangle(ax + 1, 258, 1, 6, 0x808088).setDepth(3);
      // Arrowhead at the top — a clean spearhead
      this.add.triangle(ax, 208, 0, -5, -3, 3, 3, 3, 0xc0c8d0).setDepth(3);
    }

    // Battle axe — vertical wooden haft with a single broad iron head
    // mounted near the top, drawn as one polygon so it reads as a single
    // object instead of the "play button" silhouette the previous twin
    // triangles produced.
    const axeX = 960;
    const axeY = 250;
    // Wooden haft (top of head down to butt cap)
    this.add.rectangle(axeX, axeY + 8, 5, 86, 0x4a2814).setDepth(1);
    this.add.rectangle(axeX - 1, axeY + 8, 1, 86, 0x6a3a18).setDepth(2);
    // Leather grip wraps near the bottom
    for (const wy of [axeY + 30, axeY + 38, axeY + 46]) {
      this.add.rectangle(axeX, wy, 7, 2, 0x2a1404).setDepth(2);
    }
    // Iron butt cap
    this.add.rectangle(axeX, axeY + 53, 9, 5, 0x2a2a32).setDepth(2);

    // Axe head — single broad blade with the cutting edge on the LEFT.
    // Built from a few rectangles + triangles so the silhouette reads as
    // one piece. Eye (where the haft passes through) is darker iron.
    const headY = axeY - 30;
    const headColor = 0x9098a8;
    const headDark = 0x4a525c;
    const headEdge = 0xe8edf2;
    // Eye block (around the haft)
    this.add.rectangle(axeX, headY, 10, 22, headDark).setDepth(2);
    // Main body of the blade extending to the left
    this.add.rectangle(axeX - 12, headY, 16, 26, headColor).setDepth(2);
    // Top + bottom flares that taper the head outward
    this.add.triangle(axeX - 20, headY - 12, 0, 0, 10, 0, 0, 10, headColor).setDepth(2);
    this.add.triangle(axeX - 20, headY + 12, 0, 0, 10, 0, 0, -10, headColor).setDepth(2);
    // Cutting edge — sharp triangular wedge on the far left
    this.add.triangle(axeX - 24, headY, 0, -16, 4, 0, 0, 16, headEdge).setDepth(3);
    // Polished highlight running along the edge
    this.add.rectangle(axeX - 22, headY, 1, 22, 0xfafcfe).setDepth(4);
    // Small top spike sprouting from the eye
    this.add.triangle(axeX, headY - 14, -3, 2, 3, 2, 0, -6, headDark).setDepth(2);

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
