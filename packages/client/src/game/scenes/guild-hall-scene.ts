import Phaser from 'phaser';
import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { SceneKey } from '../scene-registry';

const ROSTER_X = 900;
const INTERACT_RADIUS = 60;
const COLOR_IDLE = 0x4a2c0c;
const COLOR_HIGHLIGHT = 0x8a5c2c;
const ALPHA_IDLE = 0.8;
const ALPHA_HIGHLIGHT = 0.95;
const OUTLINE_STROKE = 3;
const OUTLINE_COLOR = 0xffd700;

export class GuildHallScene extends BaseBuildingScene {
  private rosterBody!: Phaser.GameObjects.Rectangle;
  private rosterOutline!: Phaser.GameObjects.Rectangle;
  private rosterInRange = false;

  constructor() {
    super({ key: 'guild-hall' });
  }

  override get sceneKey(): SceneKey {
    return 'guild-hall';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#100a04');
    this.addReturnSignText();

    // Long table background
    this.add.rectangle(760, 460, 700, 30, 0x3a2008, 0.7).setDepth(0);

    // Guild banners on the wall
    this.add.rectangle(500, 200, 30, 140, 0x800000, 0.8).setDepth(0);
    this.add.rectangle(900, 200, 30, 140, 0x800000, 0.8).setDepth(0);
    this.add.text(700, 160, 'Guild Hall', { fontSize: '28px', color: '#d4a030', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    // Roster board
    this.rosterBody = this.add
      .rectangle(ROSTER_X, BUILDING_DOOR_Y, 90, 65, COLOR_IDLE, ALPHA_IDLE)
      .setDepth(0);
    this.rosterOutline = this.add
      .rectangle(ROSTER_X, BUILDING_DOOR_Y, 96, 71)
      .setDepth(1)
      .setStrokeStyle(OUTLINE_STROKE, OUTLINE_COLOR, 0)
      .setFillStyle(0, 0);
    this.add
      .text(ROSTER_X, BUILDING_DOOR_Y - 52, 'Guild\nRoster', { fontSize: '11px', color: '#f0e6d2', align: 'center' })
      .setOrigin(0.5)
      .setDepth(2);

    this.player.onInteract(() => {
      if (this.rosterInRange) useTownStore.getState().setActiveModal('guild-hall');
    });

    sceneRouter.setInteractives([
      {
        id: 'guild-roster',
        label: 'Guild Roster',
        onActivate: () => useTownStore.getState().setActiveModal('guild-hall'),
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
    const nowInRange = Math.abs(playerX - ROSTER_X) < INTERACT_RADIUS;
    if (nowInRange !== this.rosterInRange) {
      this.rosterInRange = nowInRange;
      this.rosterBody.setFillStyle(
        nowInRange ? COLOR_HIGHLIGHT : COLOR_IDLE,
        nowInRange ? ALPHA_HIGHLIGHT : ALPHA_IDLE,
      );
      this.rosterOutline.setStrokeStyle(OUTLINE_STROKE, OUTLINE_COLOR, nowInRange ? 1 : 0);
    }
  }
}

registerScene('guild-hall', GuildHallScene);
