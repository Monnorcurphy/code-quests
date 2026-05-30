import Phaser from 'phaser';
import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { GuideNpc } from '../entities/guide-npc';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

const TABLE_X = 900;
const INTERACT_RADIUS = 60;
const COLOR_TABLE_IDLE = 0x5c3c1c;
const COLOR_TABLE_HIGHLIGHT = 0x9c6c3c;
const ALPHA_IDLE = 0.8;
const ALPHA_HIGHLIGHT = 0.95;
const OUTLINE_STROKE = 3;
const OUTLINE_COLOR = 0xffd700;

export class WarRoomScene extends BaseBuildingScene {
  private tableBody!: Phaser.GameObjects.Rectangle;
  private tableOutline!: Phaser.GameObjects.Rectangle;
  private tableInRange = false;

  constructor() {
    super({ key: 'war-room' });
  }

  override get sceneKey(): SceneKey {
    return 'war-room';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#1a120a');
    this.addReturnSignText();

    // Wall texture
    this.add.rectangle(640, 240, 1280, 360, 0x2a1f10).setDepth(-1);

    // Map of the Realm — proper parchment with terrain
    const mapX = 640;
    const mapY = 230;
    const mapW = 520;
    const mapH = 290;
    // Parchment with torn edges
    this.add.rectangle(mapX, mapY, mapW, mapH, 0xe8d9a6).setDepth(0);
    this.add.rectangle(mapX, mapY, mapW - 8, mapH - 8, 0xf0e0b0).setStrokeStyle(2, 0x8a6a3a).setDepth(1);
    // Title banner
    this.add.rectangle(mapX, mapY - mapH / 2 + 14, 200, 22, 0x5a3a14).setDepth(2);
    this.add
      .text(mapX, mapY - mapH / 2 + 14, 'MAP OF THE REALM', { fontSize: '12px', color: '#f0e0b0', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(3);
    // Coastline (left edge water) — curved edge using stacked offset rectangles
    // so the water doesn't look like a hard cut against the land.
    const coastX = mapX - mapW / 2 + 50;
    this.add.rectangle(coastX, mapY + 30, 80, 220, 0x3a72aa, 0.7).setDepth(2);
    // Curved coastline edge: small offset rectangles trace a soft wavy outline
    const coastEdges: Array<[number, number, number]> = [
      [coastX + 38, mapY - 70, 10],
      [coastX + 42, mapY - 50, 8],
      [coastX + 46, mapY - 30, 10],
      [coastX + 40, mapY - 10, 12],
      [coastX + 44, mapY + 10, 10],
      [coastX + 48, mapY + 30, 8],
      [coastX + 42, mapY + 50, 12],
      [coastX + 38, mapY + 70, 10],
      [coastX + 44, mapY + 90, 8],
      [coastX + 40, mapY + 110, 10],
    ];
    for (const [ex, ey, eh] of coastEdges) {
      this.add.rectangle(ex, ey, 6, eh, 0x3a72aa, 0.7).setDepth(2);
    }
    // Forests — tree icons (dark green triangle canopy + brown trunk),
    // scattered in small clusters rather than a polka-dot grid.
    const treeClusters: Array<[number, number]> = [
      [mapX - 110, mapY - 50], [mapX - 100, mapY - 38], [mapX - 118, mapY - 32],
      [mapX - 60, mapY + 50], [mapX - 50, mapY + 60], [mapX - 70, mapY + 62],
      [mapX - 20, mapY - 80], [mapX - 8, mapY - 72],
      [mapX + 50, mapY + 60], [mapX + 62, mapY + 70], [mapX + 56, mapY + 82],
      [mapX - 130, mapY + 80], [mapX - 118, mapY + 92],
    ];
    for (const [fx, fy] of treeClusters) {
      // trunk
      this.add.rectangle(fx, fy + 4, 2, 4, 0x4a2a0c).setDepth(2);
      // canopy
      this.add.triangle(fx, fy - 2, -5, 6, 5, 6, 0, -7, 0x2c4a18).setDepth(3);
      this.add.triangle(fx, fy - 5, -3, 4, 3, 4, 0, -5, 0x1c3a0c).setDepth(4);
    }
    // Mountains — clusters of 2-3 with overlapping bases, scattered properly.
    const mountainClusters: Array<{ cx: number; cy: number }> = [
      { cx: mapX + 60, cy: mapY - 50 },
      { cx: mapX + 130, cy: mapY - 30 },
      { cx: mapX + 200, cy: mapY + 10 },
    ];
    for (const { cx, cy } of mountainClusters) {
      // back-left peak (smaller, lower)
      this.add.triangle(cx - 10, cy + 2, -10, 12, 10, 12, 0, -10, 0x6a5a4a).setDepth(2);
      // center peak (larger)
      this.add.triangle(cx, cy, -14, 16, 14, 16, 0, -16, 0x807060).setDepth(2);
      this.add.triangle(cx, cy, -6, 6, 6, 6, 0, -14, 0xffffff).setDepth(3);
      // back-right peak (smaller)
      this.add.triangle(cx + 12, cy + 4, -9, 10, 9, 10, 0, -10, 0x6a5a4a).setDepth(2);
    }
    // River
    this.add.line(0, 0, mapX - 100, mapY + 90, mapX + 100, mapY + 70, 0x3a72aa).setLineWidth(3).setDepth(2);
    this.add.line(0, 0, mapX + 100, mapY + 70, mapX + 200, mapY + 100, 0x3a72aa).setLineWidth(3).setDepth(2);
    // City markers (red pins)
    const cities = [
      { x: mapX - 40, y: mapY + 30, name: 'Aldenhold' },
      { x: mapX + 30, y: mapY - 20, name: 'Karruth' },
      { x: mapX + 140, y: mapY + 80, name: 'Eastvale' },
    ];
    for (const c of cities) {
      this.add.circle(c.x, c.y, 4, 0xa01818).setDepth(4);
      this.add.circle(c.x, c.y, 6, 0xa01818, 0).setStrokeStyle(1.5, 0xa01818).setDepth(4);
      this.add
        .text(c.x + 8, c.y - 4, c.name, { fontSize: '9px', color: '#3a1a08', fontStyle: 'bold' })
        .setDepth(4);
    }
    // Compass rose — small circle in center with N/S/E/W at matching size & weight.
    const compassX = mapX + mapW / 2 - 32;
    const compassY = mapY - mapH / 2 + 40;
    this.add.circle(compassX, compassY, 18, 0xe8d9a6).setStrokeStyle(2, 0x5a3a14).setDepth(2);
    // Inner cross marks
    this.add.line(0, 0, compassX - 6, compassY, compassX + 6, compassY, 0x5a3a14).setLineWidth(1).setDepth(3);
    this.add.line(0, 0, compassX, compassY - 6, compassX, compassY + 6, 0x5a3a14).setLineWidth(1).setDepth(3);
    // Small center dot
    this.add.circle(compassX, compassY, 2, 0x5a3a14).setDepth(3);
    const compassFont = { fontSize: '11px', color: '#5a3a14', fontStyle: 'bold' } as const;
    this.add.text(compassX, compassY - 22, 'N', compassFont).setOrigin(0.5).setDepth(3);
    this.add.text(compassX, compassY + 22, 'S', compassFont).setOrigin(0.5).setDepth(3);
    this.add.text(compassX + 22, compassY, 'E', compassFont).setOrigin(0.5).setDepth(3);
    this.add.text(compassX - 22, compassY, 'W', compassFont).setOrigin(0.5).setDepth(3);

    // Hanging banners on the wall — two on each side at slightly different
    // heights, with a thicker pole at the top, gold-trim left/right edges,
    // and a "wave" effect from two adjacent offset panels.
    const bannerSpots: Array<{ x: number; y: number }> = [
      { x: 170, y: 195 }, { x: 1110, y: 195 },
    ];
    for (const { x: bx, y: by } of bannerSpots) {
      // Wooden pole at top with end caps
      this.add.rectangle(bx, by - 60, 60, 6, 0x4a3018).setDepth(0);
      this.add.rectangle(bx, by - 60, 60, 2, 0x6a4a28).setDepth(1);
      this.add.circle(bx - 30, by - 60, 4, 0x6a4a28).setDepth(1);
      this.add.circle(bx + 30, by - 60, 4, 0x6a4a28).setDepth(1);
      // Banner body — single panel, centered under the pole
      const BW = 44;
      const BH = 110;
      this.add.rectangle(bx, by, BW, BH, 0x8a1818).setDepth(0);
      // Gold trim on left + right edges, aligned with the banner body
      this.add.rectangle(bx - BW / 2 + 1, by, 2, BH, 0xc4a050).setDepth(1);
      this.add.rectangle(bx + BW / 2 - 1, by, 2, BH, 0xc4a050).setDepth(1);
      // Triangular hem CENTERED below the banner body (was off-axis before)
      this.add
        .triangle(bx, by + BH / 2 + 6, -BW / 2, -6, BW / 2, -6, 0, 12, 0x8a1818)
        .setDepth(0);
      // Crossed-axes crest centered
      this.add.text(bx, by, '⚔', { fontSize: '22px', color: '#e4c060' }).setOrigin(0.5).setDepth(2);
    }

    // Planning table
    this.tableBody = this.add
      .rectangle(TABLE_X, BUILDING_DOOR_Y, 90, 65, COLOR_TABLE_IDLE, ALPHA_IDLE)
      .setDepth(0)
      .setInteractive({ useHandCursor: true });
    this.tableBody.on('pointerdown', () =>
      useTownStore.getState().setActiveModal('draft'),
    );
    this.tableOutline = this.add
      .rectangle(TABLE_X, BUILDING_DOOR_Y, 96, 71)
      .setDepth(1)
      .setStrokeStyle(OUTLINE_STROKE, OUTLINE_COLOR, 0)
      .setFillStyle(0, 0);
    this.add
      .text(TABLE_X, BUILDING_DOOR_Y - 52, 'Planning\nTable', { fontSize: '11px', color: '#f0e6d2', align: 'center' })
      .setOrigin(0.5)
      .setDepth(2);

    this.player.onInteract(() => {
      if (this.tableInRange) useTownStore.getState().setActiveModal('draft');
    });

    // Commander Tyra — officer briefing by the planning table.
    new GuideNpc(this, {
      x: 460,
      y: BUILDING_DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      bubbleText: 'Commander Tyra — Officer',
      bubbleWidth: 190,
      onActivate: () => useTownStore.getState().openNpcHint('commander-tyra'),
    });

    sceneRouter.setInteractives([
      {
        id: 'planning-table',
        label: 'Planning Table',
        onActivate: () => useTownStore.getState().setActiveModal('draft'),
      },
      {
        id: 'commander-tyra',
        label: 'Commander Tyra (Officer)',
        onActivate: () => useTownStore.getState().openNpcHint('commander-tyra'),
      },
      this.returnDoorInteractive,
    ]);

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }

  override update(time: number, delta: number): void {
    if (useTownStore.getState().activeModal !== null) return;
    super.update(time, delta);

    const playerX = this.player.getX();
    const nowInRange = Math.abs(playerX - TABLE_X) < INTERACT_RADIUS;
    if (nowInRange !== this.tableInRange) {
      this.tableInRange = nowInRange;
      this.tableBody.setFillStyle(
        nowInRange ? COLOR_TABLE_HIGHLIGHT : COLOR_TABLE_IDLE,
        nowInRange ? ALPHA_HIGHLIGHT : ALPHA_IDLE,
      );
      this.tableOutline.setStrokeStyle(OUTLINE_STROKE, OUTLINE_COLOR, nowInRange ? 1 : 0);
    }
  }
}

registerScene('war-room', WarRoomScene);
