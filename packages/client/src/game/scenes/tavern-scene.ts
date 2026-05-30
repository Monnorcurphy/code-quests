import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { GuideNpc } from '../entities/guide-npc';
import {
  PatronNpc,
  PATRON_CATCHPHRASES,
  createPatronChorus,
} from '../entities/patron-npc';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

export class TavernScene extends BaseBuildingScene {
  private patrons: PatronNpc[] = [];

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

    // Stone hearth on the right. Built from real stone blocks (staggered
    // rectangles, not one big dark frame) with a heavy mantle beam, a
    // proper firebox opening, big fire, andirons, and a stack of logs.
    const hx = 1100;
    const hearthTop = 280;
    const hearthBottom = 440;
    // Outer stone column (back of chimney)
    this.add.rectangle(hx, (hearthTop + hearthBottom) / 2, 156, hearthBottom - hearthTop, 0x4a3a30).setDepth(0);
    // Stagger stone blocks across the chimney face — staggered courses
    const stoneA = 0x6a5a4a;
    const stoneB = 0x52423a;
    for (let row = 0; row < 6; row++) {
      const y = hearthTop + 12 + row * 24;
      const offset = row % 2 === 0 ? 0 : 22;
      for (let col = -2; col <= 2; col++) {
        const bx = hx + col * 44 + offset;
        const color = (col + row) % 2 === 0 ? stoneA : stoneB;
        this.add.rectangle(bx, y, 40, 20, color).setStrokeStyle(1, 0x2a1a14).setDepth(0);
      }
    }
    // Heavy wooden mantle beam across the top
    this.add.rectangle(hx, hearthTop - 4, 170, 14, 0x6a3a18).setDepth(1);
    this.add.rectangle(hx, hearthTop - 9, 170, 4, 0x4a2810).setDepth(1);
    // Firebox opening — arched, recessed
    const fireboxY = hearthBottom - 50;
    this.add.rectangle(hx, fireboxY, 78, 70, 0x150804).setDepth(1);
    this.add.rectangle(hx, fireboxY - 30, 78, 12, 0x150804).setDepth(1);
    // Arch curve (two small dark wedges to round the top corners)
    this.add.triangle(hx - 40, fireboxY - 36, 0, 6, 8, 0, 0, -6, 0x4a3a30).setDepth(1);
    this.add.triangle(hx + 40, fireboxY - 36, 0, 6, -8, 0, 0, -6, 0x4a3a30).setDepth(1);
    // Andirons (iron supports either side of the fire)
    this.add.rectangle(hx - 22, fireboxY + 12, 4, 22, 0x252028).setDepth(2);
    this.add.rectangle(hx + 22, fireboxY + 12, 4, 22, 0x252028).setDepth(2);
    this.add.circle(hx - 22, fireboxY, 3, 0x4a4248).setDepth(2);
    this.add.circle(hx + 22, fireboxY, 3, 0x4a4248).setDepth(2);
    // Log stack — three logs end-on, glowing embers visible
    this.add.rectangle(hx - 10, fireboxY + 22, 28, 7, 0x5a3a14).setDepth(2);
    this.add.rectangle(hx + 8, fireboxY + 24, 30, 7, 0x4a2810).setDepth(2);
    this.add.rectangle(hx, fireboxY + 18, 22, 5, 0x6a4818).setDepth(2);
    // Ember glow under the logs
    this.add.rectangle(hx, fireboxY + 28, 50, 4, 0xff5018, 0.75).setDepth(2);
    // Big fire — taller and wider than before so the firebox isn't barren
    this.add.triangle(hx, fireboxY + 4, -28, 26, 28, 26, 0, -34, 0xff7020).setDepth(3);
    this.add.triangle(hx, fireboxY + 2, -20, 22, 20, 22, 0, -28, 0xffa040).setDepth(4);
    this.add.triangle(hx, fireboxY, -12, 16, 12, 16, 0, -22, 0xffd070).setDepth(5);
    this.add.triangle(hx, fireboxY - 2, -6, 10, 6, 10, 0, -14, 0xfff5b0).setDepth(6);
    // Soft orange halo washing the wall in front of the hearth
    this.add.circle(hx, fireboxY, 64, 0xff8030, 0.06).setDepth(0);

    this.add
      .text(640, 80, 'The Tavern', { fontSize: '28px', color: '#d4804a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(2);

    // Everything in the tavern sits BACK from the front floor row so the
    // player has a clear walking strip and doesn't clip under the furniture.
    const BACK_Y_OFFSET = -110;

    // Wooden tables with mugs (pushed back into the room)
    for (const tx of [380, 580]) {
      this.add.rectangle(tx, BUILDING_DOOR_Y + 30 + BACK_Y_OFFSET, 160, 14, 0x5a3014).setDepth(0);
      this.add.rectangle(tx, BUILDING_DOOR_Y + 50 + BACK_Y_OFFSET, 14, 30, 0x3a1f08).setDepth(0);
      // mug on the table
      this.add.rectangle(tx - 30, BUILDING_DOOR_Y + 18 + BACK_Y_OFFSET, 16, 22, 0x8a5a28).setDepth(1);
      this.add.rectangle(tx - 30, BUILDING_DOOR_Y + 10 + BACK_Y_OFFSET, 18, 4, 0xf5e7b5).setDepth(2);
      this.add.rectangle(tx + 30, BUILDING_DOOR_Y + 18 + BACK_Y_OFFSET, 16, 22, 0x8a5a28).setDepth(1);
      this.add.rectangle(tx + 30, BUILDING_DOOR_Y + 10 + BACK_Y_OFFSET, 18, 4, 0xf5e7b5).setDepth(2);
    }

    // Bar counter on left (pushed back)
    this.add.rectangle(200, BUILDING_DOOR_Y + 36 + BACK_Y_OFFSET, 240, 28, 0x6a3c14).setDepth(0);
    this.add.rectangle(200, BUILDING_DOOR_Y + 56 + BACK_Y_OFFSET, 240, 16, 0x3a1f08).setDepth(0);

    // Ale barrel — interactive (pushed back to match furniture)
    const barrelX = 800;
    const barrelY = BUILDING_DOOR_Y + BACK_Y_OFFSET;
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

    // Patrons drinking around the room — two at the bar, two at tables.
    // Each occasionally surfaces a tavern-flavoured speech bubble.
    if (this.textures.exists('character/npc-villager')) {
      const reducedMotion = this.player?.reducedMotion ?? false;
      // Patrons sit at their tables / at the bar — pushed back into the room
      // so the player walks IN FRONT of them along the floor strip.
      const seats: Array<{ x: number; y: number; flipX?: boolean }> = [
        { x: 160, y: BUILDING_DOOR_Y + 4 + BACK_Y_OFFSET },
        { x: 250, y: BUILDING_DOOR_Y + 4 + BACK_Y_OFFSET, flipX: true },
        { x: 380, y: BUILDING_DOOR_Y + BACK_Y_OFFSET },
        { x: 580, y: BUILDING_DOOR_Y + BACK_Y_OFFSET, flipX: true },
      ];
      // Shared chorus — only one patron speaks at a time so bubbles don't
      // overlap. Initial delays staggered across a wide window so the first
      // wave doesn't fire simultaneously.
      const chorus = createPatronChorus();
      seats.forEach((seat, idx) => {
        // Spread first bubbles across roughly 6-36s (idx * 7s base + jitter)
        const initialDelayMs = 6_000 + idx * 7_000 + Math.random() * 4_000;
        this.patrons.push(
          new PatronNpc(this, {
            x: seat.x,
            y: seat.y,
            textureKey: 'character/npc-villager',
            catchphrases: PATRON_CATCHPHRASES,
            flipX: seat.flipX ?? false,
            reducedMotion,
            chorus,
            initialDelayMs,
          }),
        );
      });
    }

    // Innkeep Rorek — tavernkeeper IN FRONT of the bar so the player can
    // walk up and talk to him at floor level (not buried behind the tables).
    new GuideNpc(this, {
      x: 480,
      y: BUILDING_DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      bubbleText: 'Innkeep Rorek — Tavernkeeper',
      bubbleWidth: 200,
      onActivate: () => useTownStore.getState().openNpcHint('innkeep-rorek'),
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
        onActivate: () => useTownStore.getState().openNpcHint('innkeep-rorek'),
      },
      this.returnDoorInteractive,
    ]);

    // No auto-open — user clicks the Ale Barrel (or Innkeep Rorek) when ready.

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
      for (const p of this.patrons) p.destroy();
      this.patrons = [];
    });
  }
}

registerScene('tavern', TavernScene);
