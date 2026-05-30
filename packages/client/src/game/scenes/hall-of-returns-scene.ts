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
      const wallY = 250; // wall mount point — sconce hangs from here
      // Wrought-iron wall plate
      this.add.rectangle(sx, wallY - 30, 14, 10, 0x2a2a30).setDepth(2);
      // Vertical arm coming OUT of the plate (the bracket the user said
      // was missing — sconces previously floated with no holder)
      this.add.rectangle(sx, wallY - 14, 4, 22, 0x2a2a30).setDepth(2);
      // Cup / brazier that holds the flame
      this.add.rectangle(sx, wallY, 16, 6, 0x3a3038).setDepth(2);
      this.add.rectangle(sx, wallY - 3, 14, 2, 0x52525e).setDepth(3);
      // Flame above the cup
      this.add.circle(sx, wallY - 10, 7, 0xffa030, 0.35).setDepth(3);
      this.add.circle(sx, wallY - 10, 4, 0xffe070, 0.9).setDepth(4);
      this.add.circle(sx, wallY - 12, 2, 0xfffacd, 0.95).setDepth(5);
    }

    // Returned Scrolls — stone pedestal with a scroll on top, CLICKABLE
    // to open the Hall of Returns modal. Previously the scene auto-opened
    // the modal on entry; now you click here to open it.
    const pedestalX = 700;
    const pedestalY = BUILDING_DOOR_Y + 10;
    // Pedestal base (wider) — this is the click target
    const pedestalBase = this.add
      .rectangle(pedestalX, pedestalY, 60, 110, 0x3a3a44)
      .setDepth(1)
      .setInteractive({ useHandCursor: true });
    pedestalBase.on('pointerdown', () =>
      useTownStore.getState().setActiveModal('hall-of-returns'),
    );
    this.add.rectangle(pedestalX, pedestalY + 50, 80, 12, 0x2a2a34).setDepth(1);
    this.add.rectangle(pedestalX, pedestalY - 50, 78, 8, 0x4a4a54).setDepth(2);
    // Scroll on top — body + tied ends
    const scroll = this.add
      .rectangle(pedestalX, pedestalY - 60, 50, 14, 0xd8c890)
      .setStrokeStyle(1, 0x6a5a30)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    scroll.on('pointerdown', () =>
      useTownStore.getState().setActiveModal('hall-of-returns'),
    );
    this.add.circle(pedestalX - 25, pedestalY - 60, 7, 0xa89870).setDepth(3);
    this.add.circle(pedestalX + 25, pedestalY - 60, 7, 0xa89870).setDepth(3);
    // Ribbon
    this.add.rectangle(pedestalX, pedestalY - 60, 4, 18, 0x8a3030).setDepth(4);
    this.add
      .text(pedestalX, pedestalY - 88, 'Returned Scrolls', {
        fontSize: '12px',
        color: '#fef9e7',
        fontStyle: 'bold',
        backgroundColor: '#1a0e08',
        padding: { x: 6, y: 2 },
      })
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
        id: 'returned-scrolls',
        label: 'Returned Scrolls',
        onActivate: () => useTownStore.getState().setActiveModal('hall-of-returns'),
      },
      {
        id: 'keeper-vorn',
        label: 'Keeper Vorn (Undertaker)',
        onActivate: () => useTownStore.getState().openNpcHint('keeper-vorn'),
      },
      this.returnDoorInteractive,
    ]);

    // No auto-open modal — the user walks in, looks around, then clicks the
    // Returned Scrolls (or talks to Keeper Vorn) when ready.

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }
}

registerScene('hall-of-returns', HallOfReturnsScene);
