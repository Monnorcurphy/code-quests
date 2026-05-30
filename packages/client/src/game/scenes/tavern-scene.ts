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

    useTownStore.getState().setActiveModal('tavern');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
      for (const p of this.patrons) p.destroy();
      this.patrons = [];
    });
  }
}

registerScene('tavern', TavernScene);
