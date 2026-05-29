import { BaseTownScene } from './base-town-scene';
import { sceneRouter } from '../scene-router';
import type { DoorConfig } from './base-town-scene';
import type { SceneKey } from '../scene-registry';

export const BUILDING_SCENE_WIDTH = 1280;
export const BUILDING_DEFAULT_SPAWN_X = 640;

const GROUND_Y = 680;
const GROUND_HEIGHT = 80;
const GROUND_SURFACE_Y = GROUND_Y - GROUND_HEIGHT / 2;
const DOOR_HEIGHT = 96;
export const BUILDING_DOOR_Y = GROUND_SURFACE_Y - DOOR_HEIGHT / 2;
export const BUILDING_SIGN_Y = BUILDING_DOOR_Y - DOOR_HEIGHT / 2 - 20;

const RETURN_DOOR: DoorConfig = {
  x: 200,
  targetScene: 'town-square' as SceneKey,
  targetSpawnX: 1600,
  label: 'Return to Town Square',
};

const SIGN_STYLE = {
  fontSize: '11px',
  color: '#fef9e7',
  align: 'center' as const,
  fontStyle: 'bold',
  backgroundColor: '#1a0e08',
  padding: { x: 6, y: 2 },
};

export abstract class BaseBuildingScene extends BaseTownScene {
  abstract override get sceneKey(): SceneKey;

  override get defaultSpawnX(): number {
    return BUILDING_DEFAULT_SPAWN_X;
  }

  protected override get sceneWidth(): number {
    return BUILDING_SCENE_WIDTH;
  }

  // Interior — skip the outdoor sky/hills the base class draws.
  protected override get isOutdoor(): boolean {
    return false;
  }

  override get doorConfigs(): DoorConfig[] {
    return [RETURN_DOOR];
  }

  protected get returnDoorInteractive() {
    return {
      id: 'town-square' as const,
      label: 'Return to Town Square',
      onActivate: () =>
        sceneRouter.emitDoorEnter({ sceneKey: 'town-square', spawnX: 1600 }),
    };
  }

  protected addReturnSignText(): void {
    this.add
      .text(200, BUILDING_SIGN_Y, 'TOWN\nSQUARE', SIGN_STYLE)
      .setOrigin(0.5)
      .setDepth(2);
  }
}
