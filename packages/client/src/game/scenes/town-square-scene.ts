import { BaseTownScene } from './base-town-scene';
import { QuestBoardInteractive } from '../interactives/quest-board';
import { RecruitBannerInteractive } from '../interactives/recruit-banner';
import { GuideNpc } from '../entities/guide-npc';
import { registerScene } from '../scene-registry';
import { sceneRouter } from '../scene-router';
import { useTownStore } from '../../stores/town-store';
import type { DoorConfig } from './base-town-scene';
import type { SceneKey } from '../scene-registry';

const SCENE_WIDTH = 3200;
const DEFAULT_SPAWN_X = 1600;
const GROUND_Y = 680;
const GROUND_HEIGHT = 80;
const GROUND_SURFACE_Y = GROUND_Y - GROUND_HEIGHT / 2;
const DOOR_HEIGHT = 96;
const DOOR_Y = GROUND_SURFACE_Y - DOOR_HEIGHT / 2;
const SIGN_Y = DOOR_Y - DOOR_HEIGHT / 2 - 14;
const QUEST_BOARD_X = 1420;
const RECRUIT_BANNER_X = 1780;

const DOOR_CONFIGS: DoorConfig[] = [
  { x: 250, targetScene: 'war-room', targetSpawnX: 200, label: 'Door: War Room' },
  { x: 550, targetScene: 'oracle', targetSpawnX: 200, label: 'Door: Oracle' },
  { x: 850, targetScene: 'library', targetSpawnX: 200, label: 'Door: Library' },
  { x: 1150, targetScene: 'tavern', targetSpawnX: 200, label: 'Door: Tavern' },
  { x: 2050, targetScene: 'armory', targetSpawnX: 200, label: 'Door: Armory' },
  { x: 2350, targetScene: 'guild-hall', targetSpawnX: 200, label: 'Door: Guild Hall' },
  { x: 2650, targetScene: 'hall-of-returns', targetSpawnX: 200, label: 'Door: Hall of Returns' },
];

const SIGN_STYLE = {
  fontSize: '12px',
  color: '#fef9e7',
  align: 'center' as const,
  fontStyle: 'bold',
  backgroundColor: '#1a0e08',
  padding: { x: 6, y: 2 },
};

export class TownSquareScene extends BaseTownScene {
  private questBoard!: QuestBoardInteractive;
  private recruitBanner!: RecruitBannerInteractive;

  constructor() {
    super({ key: 'town-square' });
  }

  get sceneKey(): SceneKey {
    return 'town-square';
  }

  get defaultSpawnX(): number {
    return DEFAULT_SPAWN_X;
  }

  protected override get sceneWidth(): number {
    return SCENE_WIDTH;
  }

  get doorConfigs(): DoorConfig[] {
    return DOOR_CONFIGS;
  }

  override create(): void {
    super.create();

    this.questBoard = new QuestBoardInteractive(this, QUEST_BOARD_X, DOOR_Y);
    this.questBoard.registerWithPlayer(this.player);

    this.recruitBanner = new RecruitBannerInteractive(this, RECRUIT_BANNER_X, DOOR_Y);
    this.recruitBanner.registerWithPlayer(this.player);

    // Elder Hawthorne — friendly guide NPC near the spawn point
    new GuideNpc(this, {
      x: 1620,
      y: DOOR_Y + 4,
      textureKey: 'character/npc-villager',
      onActivate: () => useTownStore.getState().setActiveModal('help'),
    });

    for (const cfg of DOOR_CONFIGS) {
      const shortName = cfg.label.replace('Door: ', '');
      this.add
        .text(cfg.x, SIGN_Y, shortName, SIGN_STYLE)
        .setOrigin(0.5)
        .setDepth(2);
    }

    sceneRouter.setInteractives([
      {
        id: 'quest-board',
        label: 'Quest Board',
        onActivate: () => this.questBoard.activate(),
      },
      {
        id: 'recruit-banner',
        label: 'Recruit Banner',
        onActivate: () => this.recruitBanner.activate(),
      },
      ...DOOR_CONFIGS.map((cfg) => ({
        id: cfg.targetScene,
        label: cfg.label,
        onActivate: () =>
          sceneRouter.emitDoorEnter({ sceneKey: cfg.targetScene, spawnX: cfg.targetSpawnX }),
      })),
    ]);

    this.events.once('shutdown', () => {
      useTownStore.getState().setActiveModal(null);
    });
  }

  override update(time: number, delta: number): void {
    if (useTownStore.getState().activeModal !== null) return;
    super.update(time, delta);
    const playerX = this.player.getX();
    this.questBoard.update(playerX);
    this.recruitBanner.update(playerX);
  }
}

registerScene('town-square', TownSquareScene);
