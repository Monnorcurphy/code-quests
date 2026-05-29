import Phaser from 'phaser';
import { BaseBuildingScene, BUILDING_DOOR_Y } from './base-building-scene';
import { GuideNpc } from '../entities/guide-npc';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { ASSET_KEYS } from '../asset-loader';
import { useTownStore } from '../../stores/town-store';
import {
  useGuildHallStore,
  type GuildHallAdventurer,
} from '../../stores/guild-hall-store';
import type { SceneKey } from '../scene-registry';

const ROSTER_X = 900;
const INTERACT_RADIUS = 60;
const COLOR_IDLE = 0x4a2c0c;
const COLOR_HIGHLIGHT = 0x8a5c2c;
const ALPHA_IDLE = 0.8;
const ALPHA_HIGHLIGHT = 0.95;
const OUTLINE_STROKE = 3;
const OUTLINE_COLOR = 0xffd700;

// Adventurer sprite layout — left half of the scene (x 300-600), avoiding
// the Guild Roster interactive at x=900.
const ADVENTURER_REGION_MIN_X = 300;
const ADVENTURER_REGION_MAX_X = 600;
const ADVENTURER_Y = BUILDING_DOOR_Y;
const ADVENTURER_MIN_SPACING = 70;
const ADVENTURER_DEPTH_BODY = 1;
const ADVENTURER_DEPTH_LABEL = 2;
const ALPHA_ON_QUEST = 0.5;
const ALPHA_ROSTER_IDLE = 1;
const SCALE_ON_QUEST = 0.75;
const SCALE_ROSTER_IDLE = 1;

interface AdventurerSpriteHandles {
  sprite: Phaser.GameObjects.Sprite;
  name: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

function layoutXs(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [(ADVENTURER_REGION_MIN_X + ADVENTURER_REGION_MAX_X) / 2];
  const span = ADVENTURER_REGION_MAX_X - ADVENTURER_REGION_MIN_X;
  const idealSpacing = span / (count - 1);
  const spacing = Math.max(ADVENTURER_MIN_SPACING, Math.min(idealSpacing, span));
  // Center the row if total width is smaller than the region.
  const totalWidth = spacing * (count - 1);
  const startX = (ADVENTURER_REGION_MIN_X + ADVENTURER_REGION_MAX_X) / 2 - totalWidth / 2;
  const xs: number[] = [];
  for (let i = 0; i < count; i++) xs.push(startX + i * spacing);
  return xs;
}

export class GuildHallScene extends BaseBuildingScene {
  private rosterBody!: Phaser.GameObjects.Rectangle;
  private rosterOutline!: Phaser.GameObjects.Rectangle;
  private rosterInRange = false;
  private adventurerSprites: AdventurerSpriteHandles[] = [];
  private unsubscribeRoster: (() => void) | null = null;
  private lastRosterVersion = -1;

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
      .setDepth(0)
      .setInteractive({ useHandCursor: true });
    this.rosterBody.on('pointerdown', () =>
      useTownStore.getState().setActiveModal('guild-hall'),
    );
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

    // Master Eldra — guild master standing watch between the banners.
    new GuideNpc(this, {
      x: 760,
      y: BUILDING_DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      bubbleText: 'Master Eldra — Guild Master',
      bubbleWidth: 200,
      onActivate: () => useTownStore.getState().openNpcHint('master-eldra'),
    });

    sceneRouter.setInteractives([
      {
        id: 'guild-roster',
        label: 'Guild Roster',
        onActivate: () => useTownStore.getState().setActiveModal('guild-hall'),
      },
      {
        id: 'master-eldra',
        label: 'Master Eldra (Guild Master)',
        onActivate: () => useTownStore.getState().openNpcHint('master-eldra'),
      },
      this.returnDoorInteractive,
    ]);

    // Render adventurers based on current store state, then subscribe for updates.
    this.renderRoster(useGuildHallStore.getState().roster);
    this.lastRosterVersion = useGuildHallStore.getState().version;
    this.unsubscribeRoster = useGuildHallStore.subscribe((state) => {
      if (state.version === this.lastRosterVersion) return;
      this.lastRosterVersion = state.version;
      this.renderRoster(state.roster);
    });

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
      this.unsubscribeRoster?.();
      this.unsubscribeRoster = null;
      this.clearAdventurerSprites();
    });
  }

  private clearAdventurerSprites(): void {
    for (const h of this.adventurerSprites) {
      h.sprite.destroy();
      h.name.destroy();
      h.status.destroy();
    }
    this.adventurerSprites = [];
  }

  private renderRoster(roster: GuildHallAdventurer[]): void {
    this.clearAdventurerSprites();
    const xs = layoutXs(roster.length);
    for (let i = 0; i < roster.length; i++) {
      const adv = roster[i];
      const x = xs[i];
      if (!adv || x === undefined) continue;
      this.adventurerSprites.push(this.createAdventurerSprite(adv, x));
    }
  }

  private createAdventurerSprite(
    adv: GuildHallAdventurer,
    x: number,
  ): AdventurerSpriteHandles {
    const onQuest = adv.status === 'on-quest';
    const alpha = onQuest ? ALPHA_ON_QUEST : ALPHA_ROSTER_IDLE;
    const scale = onQuest ? SCALE_ON_QUEST : SCALE_ROSTER_IDLE;

    const sprite = this.add
      .sprite(x, ADVENTURER_Y, ASSET_KEYS.CHARACTER_ADVENTURER_IDLE)
      .setDepth(ADVENTURER_DEPTH_BODY)
      .setAlpha(alpha)
      .setScale(scale)
      .setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      useTownStore.getState().setActiveModal('guild-hall');
    });

    const nameText = this.add
      .text(x, ADVENTURER_Y - 38, adv.name, {
        fontSize: '12px',
        color: '#fef9e7',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(ADVENTURER_DEPTH_LABEL)
      .setAlpha(alpha);

    const statusLabel = onQuest ? 'On Quest' : 'Ready';
    const statusColor = onQuest ? '#d4a030' : '#7fcf7f';
    const statusText = this.add
      .text(x, ADVENTURER_Y + 30, statusLabel, {
        fontSize: '10px',
        color: statusColor,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(ADVENTURER_DEPTH_LABEL)
      .setAlpha(alpha);

    return { sprite, name: nameText, status: statusText };
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
