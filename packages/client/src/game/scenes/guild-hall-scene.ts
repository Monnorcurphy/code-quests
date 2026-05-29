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

// Adventurers stand on a raised stone dais in the middle of the hall so
// the previously-empty mid-room space reads as occupied. Carousel arrows
// page through more than MAX_VISIBLE_ADVENTURERS at a time.
const DAIS_Y = 420;
const DAIS_LEFT_X = 240;
const DAIS_RIGHT_X = 1160;
const ADVENTURER_REGION_MIN_X = 320;
const ADVENTURER_REGION_MAX_X = 1080;
const ADVENTURER_Y = 408;
const ADVENTURER_MIN_SPACING = 130;
const ADVENTURER_DEPTH_BODY = 5;
const ADVENTURER_DEPTH_LABEL = 6;
const ALPHA_ON_QUEST = 0.5;
const ALPHA_ROSTER_IDLE = 1;
const SCALE_ON_QUEST = 1.1;
const SCALE_ROSTER_IDLE = 1.4;
const MAX_VISIBLE_ADVENTURERS = 5;
const NAME_MAX_CHARS = 14;

// Carousel page arrow buttons
const ARROW_Y = ADVENTURER_Y;
const ARROW_LEFT_X = 200;
const ARROW_RIGHT_X = 1200;

function truncateName(name: string): string {
  if (name.length <= NAME_MAX_CHARS) return name;
  // Reserve one char for the ellipsis so the truncated label stays at
  // NAME_MAX_CHARS visible characters.
  return `${name.slice(0, NAME_MAX_CHARS - 1)}…`;
}

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
  private currentPage = 0;
  private leftArrow: Phaser.GameObjects.Container | null = null;
  private rightArrow: Phaser.GameObjects.Container | null = null;
  private pageLabel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'guild-hall' });
  }

  override get sceneKey(): SceneKey {
    return 'guild-hall';
  }

  override create(): void {
    super.create();
    this.cameras.main.setBackgroundColor('#0e0804');
    this.addReturnSignText();

    // Back wall — dark stone
    this.add.rectangle(700, 240, 1280, 360, 0x1c1408).setDepth(-2);
    // Wall sconces with glow
    for (const sx of [180, 420, 980, 1220]) {
      this.add.rectangle(sx, 200, 6, 28, 0x2a1a0a).setDepth(-1);
      this.add.circle(sx, 188, 6, 0xffa030, 0.4).setDepth(-1);
      this.add.circle(sx, 188, 3, 0xffe070, 0.9).setDepth(-1);
    }

    // Five framed guild portraits on the back wall
    for (let i = 0; i < 5; i++) {
      const fx = 280 + i * 220;
      this.add.rectangle(fx, 260, 96, 130, 0x3a2410).setDepth(-1);
      this.add.rectangle(fx, 260, 88, 122, 0x6a4828).setDepth(-1);
      this.add.rectangle(fx, 260, 80, 114, 0x2a1808).setDepth(-1);
      // Portrait silhouette inside
      this.add.circle(fx, 240, 14, 0x4a3624, 0.7).setDepth(-1);
      this.add.rectangle(fx, 280, 32, 28, 0x4a3624, 0.7).setDepth(-1);
    }

    // Raised stone dais — adventurers stand on this
    this.add.rectangle((DAIS_LEFT_X + DAIS_RIGHT_X) / 2, DAIS_Y + 32, DAIS_RIGHT_X - DAIS_LEFT_X, 16, 0x0a0604).setDepth(2);
    this.add.rectangle((DAIS_LEFT_X + DAIS_RIGHT_X) / 2, DAIS_Y + 36, DAIS_RIGHT_X - DAIS_LEFT_X, 12, 0x4a3624).setDepth(3);
    this.add.rectangle((DAIS_LEFT_X + DAIS_RIGHT_X) / 2, DAIS_Y + 42, DAIS_RIGHT_X - DAIS_LEFT_X + 12, 6, 0x6a5430).setDepth(3);
    // Dais front trim with grooves
    for (let x = DAIS_LEFT_X + 30; x < DAIS_RIGHT_X; x += 90) {
      this.add.rectangle(x, DAIS_Y + 36, 2, 12, 0x2a1a0a).setDepth(4);
    }

    // Long table background — moved to floor level (below the dais)
    this.add.rectangle(760, 540, 700, 22, 0x3a2008, 0.8).setDepth(0);
    this.add.rectangle(760, 552, 700, 8, 0x2a1808).setDepth(0);

    // Two hanging guild banners ON the back wall (smaller, decorative)
    this.add.rectangle(180, 180, 40, 130, 0x800000, 0.9).setDepth(-1);
    this.add.triangle(180, 245, -20, 0, 20, 0, 0, 12, 0x800000, 0.9).setDepth(-1);
    this.add.rectangle(180, 180, 4, 130, 0xc4a050, 0.7).setDepth(-1);
    this.add.text(180, 200, '⚔', { fontSize: '20px', color: '#d4a030' }).setOrigin(0.5).setDepth(-1);

    this.add.rectangle(1220, 180, 40, 130, 0x800000, 0.9).setDepth(-1);
    this.add.triangle(1220, 245, -20, 0, 20, 0, 0, 12, 0x800000, 0.9).setDepth(-1);
    this.add.rectangle(1220, 180, 4, 130, 0xc4a050, 0.7).setDepth(-1);
    this.add.text(1220, 200, '⚔', { fontSize: '20px', color: '#d4a030' }).setOrigin(0.5).setDepth(-1);

    this.add.text(700, 100, 'Guild Hall', { fontSize: '28px', color: '#d4a030', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

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

    // Carousel arrows + page indicator (created hidden; shown only when
    // the roster overflows one page)
    this.leftArrow = this._buildArrow(ARROW_LEFT_X, ARROW_Y, '◀', () => this._changePage(-1));
    this.rightArrow = this._buildArrow(ARROW_RIGHT_X, ARROW_Y, '▶', () => this._changePage(1));
    this.pageLabel = this.add
      .text(700, DAIS_Y + 68, '', {
        fontSize: '11px',
        color: '#fef9e7',
        fontStyle: 'bold',
        backgroundColor: '#1a0e08',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(7);

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
      this.leftArrow?.destroy();
      this.rightArrow?.destroy();
      this.pageLabel?.destroy();
    });
  }

  private _buildArrow(x: number, y: number, glyph: string, onClick: () => void): Phaser.GameObjects.Container {
    const bg = this.add
      .circle(0, 0, 22, 0x3a2410)
      .setStrokeStyle(2, 0xc4a050);
    const label = this.add
      .text(0, 0, glyph, { fontSize: '20px', color: '#fef9e7', fontStyle: 'bold' })
      .setOrigin(0.5);
    const container = this.add.container(x, y, [bg, label]).setDepth(7).setVisible(false);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => onClick());
    return container;
  }

  private _changePage(delta: number): void {
    const total = useGuildHallStore.getState().roster.length;
    const pageCount = Math.max(1, Math.ceil(total / MAX_VISIBLE_ADVENTURERS));
    this.currentPage = Math.max(0, Math.min(pageCount - 1, this.currentPage + delta));
    this.renderRoster(useGuildHallStore.getState().roster);
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
    const pageCount = Math.max(1, Math.ceil(roster.length / MAX_VISIBLE_ADVENTURERS));
    // Clamp page in case roster shrank
    if (this.currentPage >= pageCount) this.currentPage = pageCount - 1;
    const start = this.currentPage * MAX_VISIBLE_ADVENTURERS;
    const visible = roster.slice(start, start + MAX_VISIBLE_ADVENTURERS);
    const xs = layoutXs(visible.length);
    for (let i = 0; i < visible.length; i++) {
      const adv = visible[i];
      const x = xs[i];
      if (!adv || x === undefined) continue;
      this.adventurerSprites.push(this.createAdventurerSprite(adv, x));
    }
    // Update carousel chrome
    const hasOverflow = roster.length > MAX_VISIBLE_ADVENTURERS;
    this.leftArrow?.setVisible(hasOverflow).setAlpha(this.currentPage > 0 ? 1 : 0.35);
    this.rightArrow?.setVisible(hasOverflow).setAlpha(this.currentPage < pageCount - 1 ? 1 : 0.35);
    if (this.pageLabel) {
      if (hasOverflow) {
        this.pageLabel.setText(`Page ${this.currentPage + 1} of ${pageCount}`).setVisible(true);
      } else {
        this.pageLabel.setVisible(false);
      }
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
      .text(x, ADVENTURER_Y - 38, truncateName(adv.name), {
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
