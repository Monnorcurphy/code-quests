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
    // Ocean / coast — one solid polygon. Previously stacked alpha ellipses
    // showed visible seams ("comb teeth") wherever they overlapped; switching
    // to a Graphics fillPath gives one continuous mass with a smooth wavy
    // eastern shore.
    const seaColor = 0x3a72aa;
    const seaTop = mapY - 110;
    const seaBottom = mapY + 130;
    const westX = mapX - mapW / 2 + 6;
    const baseCoastX = mapX - mapW / 2 + 30;
    const riverMouthY = mapY + 50;

    // Eastern shoreline points — alternating bumps + a bay around the river
    // mouth. Walks top→bottom. Each entry is a horizontal offset added to
    // baseCoastX, so the polygon edge wobbles instead of sitting on a
    // straight vertical line.
    const shoreOffsets: { y: number; dx: number }[] = [
      { y: seaTop, dx: 0 },
      { y: seaTop + 24, dx: 18 },
      { y: seaTop + 48, dx: 8 },
      { y: seaTop + 72, dx: 22 },
      { y: seaTop + 96, dx: 6 },
      // Bay around the river mouth — peninsulas above and below pinch in,
      // and the coast pushes east to form a small inlet at riverMouthY.
      { y: riverMouthY - 14, dx: 14 },
      { y: riverMouthY, dx: 40 },
      { y: riverMouthY + 14, dx: 18 },
      { y: seaTop + 168, dx: 4 },
      { y: seaTop + 196, dx: 20 },
      { y: seaTop + 220, dx: 6 },
      { y: seaBottom, dx: 0 },
    ];

    const water = this.add.graphics().setDepth(2);
    water.fillStyle(seaColor, 1);
    water.beginPath();
    // Start at NW corner, walk south along the western edge, then north
    // along the wavy eastern shoreline back to the start.
    water.moveTo(westX, seaTop);
    water.lineTo(westX, seaBottom);
    for (let i = shoreOffsets.length - 1; i >= 0; i--) {
      const p = shoreOffsets[i]!;
      water.lineTo(baseCoastX + p.dx, p.y);
    }
    water.closePath();
    water.fillPath();

    // Subtle lighter band along the shore where the surf would catch
    const surf = this.add.graphics().setDepth(3);
    surf.lineStyle(1.5, 0x5e8fc4, 0.7);
    surf.beginPath();
    for (let i = 0; i < shoreOffsets.length; i++) {
      const p = shoreOffsets[i]!;
      const x = baseCoastX + p.dx + 1;
      if (i === 0) surf.moveTo(x, p.y);
      else surf.lineTo(x, p.y);
    }
    surf.strokePath();

    // For downstream code that positions things relative to the coast.
    const coastBaseX = baseCoastX;

    // Forests — proper clusters of trees, not 3-4 scattered points
    const forestRegions: Array<{ cx: number; cy: number; count: number }> = [
      { cx: mapX - 90, cy: mapY - 40, count: 9 },
      { cx: mapX - 30, cy: mapY - 70, count: 6 },
      { cx: mapX - 60, cy: mapY + 60, count: 10 },
      { cx: mapX + 50, cy: mapY + 50, count: 8 },
      { cx: mapX - 110, cy: mapY + 90, count: 7 },
    ];
    let treeSeed = 1;
    const pseudo = () => {
      treeSeed = (treeSeed * 9301 + 49297) % 233280;
      return treeSeed / 233280;
    };
    for (const region of forestRegions) {
      for (let i = 0; i < region.count; i++) {
        const r = 18 * Math.sqrt(pseudo());
        const theta = pseudo() * Math.PI * 2;
        const fx = Math.round(region.cx + Math.cos(theta) * r);
        const fy = Math.round(region.cy + Math.sin(theta) * r * 0.6);
        // Don't draw trees over the water
        if (fx < coastBaseX + 50) continue;
        // trunk
        this.add.rectangle(fx, fy + 4, 2, 4, 0x4a2a0c).setDepth(2);
        // layered canopy
        this.add.triangle(fx, fy - 2, -5, 6, 5, 6, 0, -7, 0x2c4a18).setDepth(3);
        this.add.triangle(fx, fy - 5, -3, 4, 3, 4, 0, -5, 0x1c3a0c).setDepth(4);
      }
    }
    // Mountains — clusters of 2-3 with overlapping bases
    const mountainClusters: Array<{ cx: number; cy: number }> = [
      { cx: mapX + 60, cy: mapY - 50 },
      { cx: mapX + 130, cy: mapY - 30 },
      { cx: mapX + 200, cy: mapY + 10 },
    ];
    for (const { cx, cy } of mountainClusters) {
      this.add.triangle(cx - 10, cy + 2, -10, 12, 10, 12, 0, -10, 0x6a5a4a).setDepth(2);
      this.add.triangle(cx, cy, -14, 16, 14, 16, 0, -16, 0x807060).setDepth(2);
      this.add.triangle(cx, cy, -6, 6, 6, 6, 0, -14, 0xffffff).setDepth(3);
      this.add.triangle(cx + 12, cy + 4, -9, 10, 9, 10, 0, -10, 0x6a5a4a).setDepth(2);
    }
    // River — connects from the mountains (right) all the way to the sea
    // (left), draining into the bay. Final segment ends a few pixels inside
    // the water polygon so the river visually meets the coast.
    const riverEndX = coastBaseX + 42;
    this.add.line(0, 0, mapX + 200, mapY - 10, mapX + 100, mapY + 30, seaColor).setLineWidth(3).setDepth(3);
    this.add.line(0, 0, mapX + 100, mapY + 30, mapX + 10, mapY + 50, seaColor).setLineWidth(3).setDepth(3);
    this.add.line(0, 0, mapX + 10, mapY + 50, riverEndX, riverMouthY, seaColor).setLineWidth(3).setDepth(3);
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
    // Compass rose — needle-style, not a clock face. A red north arrow + a
    // white south arrow forming a vertical dart, with cardinal letters.
    const compassX = mapX + mapW / 2 - 32;
    const compassY = mapY - mapH / 2 + 40;
    this.add.circle(compassX, compassY, 18, 0xe8d9a6).setStrokeStyle(2, 0x5a3a14).setDepth(2);
    // North half of needle — red triangle pointing up
    this.add
      .triangle(compassX, compassY - 5, 0, -12, -4, 4, 4, 4, 0xa01818)
      .setDepth(3);
    // South half — white triangle pointing down
    this.add
      .triangle(compassX, compassY + 5, 0, 12, -4, -4, 4, -4, 0xfaf5e0)
      .setStrokeStyle(1, 0x5a3a14)
      .setDepth(3);
    // Center pin
    this.add.circle(compassX, compassY, 1.5, 0x5a3a14).setDepth(4);
    const compassFont = { fontSize: '10px', color: '#5a3a14', fontStyle: 'bold' } as const;
    this.add.text(compassX, compassY - 24, 'N', compassFont).setOrigin(0.5).setDepth(4);
    this.add.text(compassX, compassY + 24, 'S', compassFont).setOrigin(0.5).setDepth(4);
    this.add.text(compassX + 24, compassY, 'E', compassFont).setOrigin(0.5).setDepth(4);
    this.add.text(compassX - 24, compassY, 'W', compassFont).setOrigin(0.5).setDepth(4);

    // Hanging banners on the wall — two on each side at slightly different
    // heights, with a thicker pole at the top, gold-trim left/right edges,
    // and a "wave" effect from two adjacent offset panels.
    const bannerSpots: Array<{ x: number; y: number }> = [
      { x: 170, y: 200 }, { x: 1110, y: 200 },
    ];
    for (const { x: bx, y: by } of bannerSpots) {
      const BW = 50;
      const BH = 110;
      // Wooden pole at top — matched to banner width so it doesn't look
      // like a clothesline. Slight extension on each side for caps.
      this.add.rectangle(bx, by - BH / 2 - 4, BW + 8, 5, 0x4a3018).setDepth(0);
      this.add.rectangle(bx, by - BH / 2 - 4, BW + 8, 2, 0x6a4a28).setDepth(1);
      this.add.circle(bx - BW / 2 - 4, by - BH / 2 - 4, 3, 0x6a4a28).setDepth(1);
      this.add.circle(bx + BW / 2 + 4, by - BH / 2 - 4, 3, 0x6a4a28).setDepth(1);
      // Banner cloth — flat rectangle (no off-axis triangle hem)
      this.add.rectangle(bx, by, BW, BH, 0x8a1818).setDepth(0);
      // Gold trim along left + right edges
      this.add.rectangle(bx - BW / 2 + 1, by, 2, BH, 0xc4a050).setDepth(1);
      this.add.rectangle(bx + BW / 2 - 1, by, 2, BH, 0xc4a050).setDepth(1);
      // Bottom hem as a clean dark band, no triangle
      this.add.rectangle(bx, by + BH / 2 - 3, BW, 4, 0x5a0e0e).setDepth(1);
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
