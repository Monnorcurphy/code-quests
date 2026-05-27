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
  // 0x72 Dungeon Tileset II — CC-BY (credit: "Dungeon Tileset II" by 0x72)
  DUNGEON_TILESET: 'dungeon/tileset',
} as const;

export type AssetKey = (typeof ASSET_KEYS)[keyof typeof ASSET_KEYS];

const ASSET_BASE = '/assets/';

export function assetPath(key: AssetKey): string {
  return `${ASSET_BASE}${key}.png`;
}

export function preloadCommonAssets(scene: Phaser.Scene): void {
  for (const key of Object.values(ASSET_KEYS)) {
    scene.load.image(key, assetPath(key as AssetKey));
  }
}
