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
    this.cameras.main.setBackgroundColor('#160e08');
    this.addReturnSignText();

    // Background map on the wall
    this.add.rectangle(760, 220, 400, 240, 0x3c2810, 0.6).setDepth(0);
    this.add.text(760, 220, 'Map of the Realm', { fontSize: '13px', color: '#c8a060' }).setOrigin(0.5).setDepth(2);

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
