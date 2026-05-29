import Phaser from 'phaser';
import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
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
    // Coastline (left edge water)
    this.add.rectangle(mapX - mapW / 2 + 50, mapY + 30, 80, 220, 0x3a72aa, 0.7).setDepth(2);
    // Forests
    for (let i = 0; i < 12; i++) {
      const fx = mapX - 140 + (i * 33) % 320;
      const fy = mapY - 60 + ((i * 47) % 220);
      this.add.circle(fx, fy, 6, 0x4a6a28).setDepth(2);
      this.add.circle(fx + 4, fy - 2, 5, 0x3a5a18).setDepth(3);
    }
    // Mountains
    for (let i = 0; i < 5; i++) {
      const mx = mapX + 80 + i * 28;
      this.add.triangle(mx, mapY - 40, -14, 16, 14, 16, 0, -16, 0x807060).setDepth(2);
      this.add.triangle(mx, mapY - 40, -8, 8, 8, 8, 0, -16, 0xffffff).setDepth(3);
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
    // Compass rose
    this.add.circle(mapX + mapW / 2 - 32, mapY - mapH / 2 + 40, 18, 0xe8d9a6).setStrokeStyle(2, 0x5a3a14).setDepth(2);
    this.add.text(mapX + mapW / 2 - 32, mapY - mapH / 2 + 32, 'N', { fontSize: '11px', color: '#5a3a14', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
    this.add.text(mapX + mapW / 2 - 32, mapY - mapH / 2 + 48, 'S', { fontSize: '9px', color: '#5a3a14' }).setOrigin(0.5).setDepth(3);

    // Hanging banners on the wall
    for (const bx of [200, 1080]) {
      this.add.rectangle(bx, 200, 50, 110, 0x7a1818).setDepth(0);
      this.add.triangle(bx, 260, -25, -5, 25, -5, 0, 12, 0x7a1818).setDepth(0);
      this.add.rectangle(bx, 200, 50, 4, 0xa07020).setDepth(1);
      // Crossed-axes crest
      this.add.text(bx, 220, '⚔', { fontSize: '24px', color: '#c4a050' }).setOrigin(0.5).setDepth(2);
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

    sceneRouter.setInteractives([
      {
        id: 'planning-table',
        label: 'Planning Table',
        onActivate: () => useTownStore.getState().setActiveModal('draft'),
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
