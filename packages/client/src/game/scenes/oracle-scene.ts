import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { GuideNpc } from '../entities/guide-npc';
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

    // Star sprinkle on the dark wall
    for (let i = 0; i < 70; i++) {
      const sx = 80 + ((i * 137) % 1100);
      const sy = 60 + ((i * 53) % 380);
      const size = (i % 3) + 1;
      this.add.circle(sx, sy, size, 0xeae0ff, 0.7).setDepth(0);
    }
    // Constellation lines — constrained to the wall region (x: 100-1200,
    // y: 80-380) so they don't extend into the top-left corner outside the
    // intended drawing area.
    const CONSTELLATION_MIN_X = 100;
    const CONSTELLATION_MAX_X = 1200;
    const CONSTELLATION_MIN_Y = 80;
    const CONSTELLATION_MAX_Y = 380;
    const inBounds = (x: number, y: number): boolean =>
      x >= CONSTELLATION_MIN_X && x <= CONSTELLATION_MAX_X &&
      y >= CONSTELLATION_MIN_Y && y <= CONSTELLATION_MAX_Y;
    const constellationSegments: Array<[number, number, number, number]> = [
      [200, 120, 280, 90],
      [280, 90, 360, 160],
      [900, 100, 1000, 180],
    ];
    for (const [x1, y1, x2, y2] of constellationSegments) {
      if (!inBounds(x1, y1) || !inBounds(x2, y2)) continue;
      this.add.line(0, 0, x1, y1, x2, y2, 0x9080ff, 0.5).setDepth(0);
    }

    this.add
      .text(760, 80, 'The Oracle', { fontSize: '28px', color: '#c090ff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(2);

    // Pedestal
    this.add.rectangle(760, BUILDING_DOOR_Y + 10, 80, 60, 0x2a1054).setDepth(1);
    this.add.rectangle(760, BUILDING_DOOR_Y - 22, 96, 8, 0x4030a0).setDepth(1);
    // Crystal ball — interactive, glowing
    const halo = this.add.circle(760, BUILDING_DOOR_Y - 44, 38, 0x9060ff, 0.18).setDepth(1);
    const ball = this.add
      .circle(760, BUILDING_DOOR_Y - 44, 26, 0x9060ff)
      .setStrokeStyle(2, 0xe8d0ff)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    ball.on('pointerdown', () => useTownStore.getState().setActiveModal('oracle'));
    halo.setInteractive({ useHandCursor: true });
    halo.on('pointerdown', () => useTownStore.getState().setActiveModal('oracle'));
    // Inner highlight
    this.add.circle(752, BUILDING_DOOR_Y - 52, 8, 0xfaf0ff, 0.6).setDepth(3);
    this.add
      .text(760, BUILDING_DOOR_Y - 100, 'Crystal Ball', {
        fontSize: '12px', color: '#fef9e7', fontStyle: 'bold',
        backgroundColor: '#1a0e08', padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(3);

    // Seer Caelis — priestess tending the crystal ball.
    new GuideNpc(this, {
      x: 420,
      y: BUILDING_DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      bubbleText: 'Seer Caelis — Priestess',
      bubbleWidth: 170,
      onActivate: () => useTownStore.getState().openNpcHint('seer-caelis'),
    });

    sceneRouter.setInteractives([
      {
        id: 'crystal-ball',
        label: 'Crystal Ball',
        onActivate: () => useTownStore.getState().setActiveModal('oracle'),
      },
      {
        id: 'seer-caelis',
        label: 'Seer Caelis (Priestess)',
        onActivate: () => useTownStore.getState().openNpcHint('seer-caelis'),
      },
      this.returnDoorInteractive,
    ]);

    useTownStore.getState().setActiveModal('oracle');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('oracle', OracleScene);
