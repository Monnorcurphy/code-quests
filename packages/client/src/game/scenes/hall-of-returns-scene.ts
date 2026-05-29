import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { GuideNpc } from '../entities/guide-npc';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

export class HallOfReturnsScene extends BaseBuildingScene {
  constructor() {
    super({ key: 'hall-of-returns' });
  }

  override get sceneKey(): SceneKey {
    return 'hall-of-returns';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#0a0810');
    this.addReturnSignText();

    // Darker wall wash to match the somber palette
    this.add.rectangle(640, 250, 1280, 360, 0x14101c, 0.6).setDepth(-1);

    this.add.text(700, 80, 'Hall of Returns', { fontSize: '26px', color: '#9090b8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    // Stone tombs along the back wall — grey, slightly varied heights.
    // Tombs are positioned so banners and sconces alternate between them.
    const tombs: Array<{ x: number; h: number }> = [
      { x: 380, h: 130 },
      { x: 540, h: 145 },
      { x: 860, h: 138 },
      { x: 1020, h: 125 },
    ];
    for (const { x, h } of tombs) {
      const tombY = 220;
      // Base shadow
      this.add.rectangle(x, tombY + h / 2 + 4, 92, 8, 0x05050a, 0.7).setDepth(0);
      // Tomb body
      this.add.rectangle(x, tombY, 88, h, 0x3a3a44).setDepth(1);
      // Top slab
      this.add.rectangle(x, tombY - h / 2 - 4, 96, 8, 0x4a4a54).setDepth(2);
      // Engraved panel
      this.add.rectangle(x, tombY + 4, 60, h - 36, 0x2a2a34).setStrokeStyle(1, 0x52525e).setDepth(2);
      // Cross engraving
      this.add.rectangle(x, tombY, 4, 22, 0x52525e).setDepth(3);
      this.add.rectangle(x, tombY - 4, 14, 4, 0x52525e).setDepth(3);
    }

    // Faded banners above each tomb — muted color, slightly torn at the bottom
    // (tatter triangles cut into the hem).
    const bannerColors = [0x4a2030, 0x2a3a4a, 0x3a3020, 0x2a3030];
    for (let i = 0; i < tombs.length; i++) {
      const tomb = tombs[i];
      if (!tomb) continue;
      const bx = tomb.x;
      const by = 130;
      const color = bannerColors[i % bannerColors.length] ?? 0x4a2030;
      // Pole
      this.add.rectangle(bx, by - 28, 36, 4, 0x2a2018).setDepth(1);
      // Banner body
      this.add.rectangle(bx, by, 30, 50, color, 0.75).setDepth(1);
      // Faded gold trim
      this.add.rectangle(bx - 15, by, 2, 50, 0x6a5a30, 0.6).setDepth(2);
      this.add.rectangle(bx + 15, by, 2, 50, 0x6a5a30, 0.6).setDepth(2);
      // Tattered hem — triangles cut UP into the banner bottom
      this.add.triangle(bx - 8, by + 24, -4, -6, 4, -6, 0, 4, 0x0a0810).setDepth(2);
      this.add.triangle(bx, by + 25, -4, -7, 4, -7, 0, 4, 0x0a0810).setDepth(2);
      this.add.triangle(bx + 8, by + 24, -4, -6, 4, -6, 0, 4, 0x0a0810).setDepth(2);
    }

    // Candle sconces between tombs — small black sconce + flickering yellow circle.
    const sconceXs: number[] = [];
    for (let i = 0; i < tombs.length - 1; i++) {
      const a = tombs[i];
      const b = tombs[i + 1];
      if (!a || !b) continue;
      sconceXs.push((a.x + b.x) / 2);
    }
    for (const sx of sconceXs) {
      const sconceY = 200;
      // Sconce bracket
      this.add.rectangle(sx, sconceY + 8, 10, 14, 0x1a1a20).setDepth(2);
      this.add.rectangle(sx, sconceY, 14, 4, 0x1a1a20).setDepth(2);
      // Candle
      this.add.rectangle(sx, sconceY - 6, 4, 10, 0xd0c098).setDepth(3);
      // Flame halo + flame
      this.add.circle(sx, sconceY - 14, 6, 0xffa030, 0.35).setDepth(3);
      this.add.circle(sx, sconceY - 14, 3, 0xffe070, 0.9).setDepth(4);
    }

    // Returned Scrolls — redrawn as a stone pedestal with a scroll on top.
    // The whole thing remains interactive via the modal that the scene opens
    // automatically; the React layer owns the click handling.
    const pedestalX = 700;
    const pedestalY = BUILDING_DOOR_Y + 10;
    // Pedestal base (wider)
    this.add.rectangle(pedestalX, pedestalY + 26, 90, 12, 0x2a2a34).setDepth(1);
    // Pedestal column
    this.add.rectangle(pedestalX, pedestalY, 60, 60, 0x3a3a44).setStrokeStyle(2, 0x4a4a54).setDepth(1);
    // Pedestal top
    this.add.rectangle(pedestalX, pedestalY - 30, 78, 8, 0x4a4a54).setDepth(2);
    // Scroll on top — body + tied ends
    this.add.rectangle(pedestalX, pedestalY - 40, 50, 14, 0xd8c890).setStrokeStyle(1, 0x6a5a30).setDepth(3);
    this.add.circle(pedestalX - 25, pedestalY - 40, 7, 0xa89870).setDepth(3);
    this.add.circle(pedestalX + 25, pedestalY - 40, 7, 0xa89870).setDepth(3);
    // Ribbon
    this.add.rectangle(pedestalX, pedestalY - 40, 4, 18, 0x8a3030).setDepth(4);
    this.add
      .text(pedestalX, pedestalY - 70, 'Returned\nScrolls', { fontSize: '11px', color: '#9090b8', align: 'center' })
      .setOrigin(0.5)
      .setDepth(4);

    // Keeper Vorn — undertaker tending the returned scrolls.
    new GuideNpc(this, {
      x: 380,
      y: BUILDING_DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      bubbleText: 'Keeper Vorn — Undertaker',
      bubbleWidth: 180,
      onActivate: () => useTownStore.getState().openNpcHint('keeper-vorn'),
    });

    sceneRouter.setInteractives([
      {
        id: 'keeper-vorn',
        label: 'Keeper Vorn (Undertaker)',
        onActivate: () => useTownStore.getState().openNpcHint('keeper-vorn'),
      },
      this.returnDoorInteractive,
    ]);

    useTownStore.getState().setActiveModal('hall-of-returns');

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('hall-of-returns', HallOfReturnsScene);
