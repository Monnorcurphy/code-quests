import type Phaser from 'phaser';

export const ASSET_KEYS = {
  // Kenney Tiny Town — CC0
  TOWN_GROUND_GRASS: 'town/ground-grass',
  TOWN_GROUND_DIRT: 'town/ground-dirt',
  TOWN_GROUND_STONE: 'town/ground-stone',
  TOWN_BUILDING_HOUSE: 'town/building-house',
  TOWN_BUILDING_SHOP: 'town/building-shop',
  TOWN_BUILDING_TAVERN: 'town/building-tavern',
  TOWN_BUILDING_CHURCH: 'town/building-church',
  TOWN_TREE_LARGE: 'town/tree-large',
  TOWN_TREE_SMALL: 'town/tree-small',
  TOWN_FENCE: 'town/fence',
  TOWN_PATH: 'town/path',
  // Kenney 1-Bit Pack — CC0
  CHARACTER_ADVENTURER_IDLE: 'character/adventurer-idle',
  CHARACTER_ADVENTURER_WALK: 'character/adventurer-walk',
  CHARACTER_ADVENTURER_ATTACK: 'character/adventurer-attack',
  CHARACTER_NPC_VILLAGER: 'character/npc-villager',
  // Kenney Tiny Dungeon — CC0
  DUNGEON_KENNEY_WALL: 'dungeon/kenney-wall',
  DUNGEON_KENNEY_FLOOR: 'dungeon/kenney-floor',
  DUNGEON_KENNEY_DOOR: 'dungeon/kenney-door',
  DUNGEON_KENNEY_PROP: 'dungeon/kenney-prop',
  // 0x72 Dungeon Tileset II — CC-BY (credit: "Dungeon Tileset II" by 0x72)
  DUNGEON_TILESET: 'dungeon/tileset',
} as const;

// Phase 5 quest scene assets — loaded only for quest scenes, not town scenes
export const QUEST_ASSET_KEYS = {
  // Kenney Nature Platformer — CC0 (backgrounds, ground, props)
  QUEST_BG_FOREST: 'quest/bg-forest',
  QUEST_BG_CAVE: 'quest/bg-cave',
  QUEST_BG_DUNGEON: 'quest/bg-dungeon',
  QUEST_BG_BOSS_ROOM: 'quest/bg-boss-room',
  QUEST_PROP_FOREST_TREE: 'quest/prop-forest-tree',
  QUEST_PROP_CAVE_ROCK: 'quest/prop-cave-rock',
  QUEST_PROP_DUNGEON_PILLAR: 'quest/prop-dungeon-pillar',
  QUEST_PROP_BOSS_THRONE: 'quest/prop-boss-throne',
  QUEST_GROUND_FOREST: 'quest/ground-forest',
  QUEST_GROUND_CAVE: 'quest/ground-cave',
  QUEST_GROUND_DUNGEON: 'quest/ground-dungeon',
  QUEST_GROUND_BOSS: 'quest/ground-boss',
  // Kenney 1-Bit Pack — CC0 (monster silhouettes, RGBA with transparency)
  QUEST_SILHOUETTE_MONSTER_SMALL: 'quest/silhouette-monster-small',
  QUEST_SILHOUETTE_MONSTER_LARGE: 'quest/silhouette-monster-large',
} as const;

export type AssetKey =
  | (typeof ASSET_KEYS)[keyof typeof ASSET_KEYS]
  | (typeof QUEST_ASSET_KEYS)[keyof typeof QUEST_ASSET_KEYS];

const ASSET_BASE = '/assets/';

export function assetPath(key: AssetKey): string {
  return `${ASSET_BASE}${key}.png`;
}

export function preloadCommonAssets(scene: Phaser.Scene): void {
  for (const key of Object.values(ASSET_KEYS)) {
    scene.load.image(key, assetPath(key as AssetKey));
  }
}

export function preloadQuestAssets(scene: Phaser.Scene): void {
  for (const key of Object.values(QUEST_ASSET_KEYS)) {
    scene.load.image(key, assetPath(key as AssetKey));
  }
}
